/**
 * Google Drive Service — Edge Function
 * 
 * Operações disponíveis via campo `action` no body:
 * - createFolder: Cria pasta no Google Drive
 * - uploadFile: Upload de arquivo (base64)
 * - listClientFiles: Lista arquivos de uma pasta
 * - renameFile: Renomeia arquivo/pasta
 * - deleteFile: Move arquivo/pasta para lixeira
 * - moveFile: Move arquivo/pasta para outra pasta
 * 
 * Todas as operações usam getValidToken() para autenticação
 * transparente com refresh automático.
 */

import { instrument } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { getValidToken, createSupabaseAdmin } from '../_shared/google-auth.ts'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CreateFolderPayload {
    action: 'createFolder'
    workspaceId: string
    folderName: string
    parentFolderId?: string
}

interface UploadFilePayload {
    action: 'uploadFile'
    workspaceId: string
    fileName: string
    mimeType: string
    base64Content: string
    folderId?: string
}

interface ListFilesPayload {
    action: 'listClientFiles'
    workspaceId: string
    folderId?: string
    query?: string
    pageSize?: number
    pageToken?: string
}

interface RenameFilePayload {
    action: 'renameFile'
    workspaceId: string
    fileId: string
    newName: string
}

interface DeleteFilePayload {
    action: 'deleteFile'
    workspaceId: string
    fileId: string
}

interface MoveFilePayload {
    action: 'moveFile'
    workspaceId: string
    fileId: string
    newParentId: string
}

type DrivePayload = CreateFolderPayload | UploadFilePayload | ListFilesPayload | RenameFilePayload | DeleteFilePayload | MoveFilePayload

// ─── Constants ─────────────────────────────────────────────────────────────────

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'

// ─── Drive Operations ──────────────────────────────────────────────────────────

async function createFolder(
    accessToken: string,
    folderName: string,
    parentFolderId?: string
): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
    }

    if (parentFolderId) {
        metadata.parents = [parentFolderId]
    }

    const response = await fetch(`${DRIVE_API_BASE}/files`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(`Drive createFolder failed: ${JSON.stringify(error)}`)
    }

    return await response.json()
}

async function uploadFile(
    accessToken: string,
    fileName: string,
    mimeType: string,
    base64Content: string,
    folderId?: string
): Promise<Record<string, unknown>> {
    // Step 1: Create file metadata
    const metadata: Record<string, unknown> = { name: fileName }
    if (folderId) {
        metadata.parents = [folderId]
    }

    // Step 2: Multipart upload (metadata + content)
    const boundary = '-------lever_upload_boundary'
    const fileBytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0))

    const metadataPart = JSON.stringify(metadata)
    const bodyParts = [
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        metadataPart,
        `\r\n--${boundary}\r\n`,
        `Content-Type: ${mimeType}\r\n\r\n`,
    ]

    // Build body as Uint8Array for binary support
    const encoder = new TextEncoder()
    const textPrefix = encoder.encode(bodyParts.join(''))
    const textSuffix = encoder.encode(`\r\n--${boundary}--`)

    const body = new Uint8Array(textPrefix.length + fileBytes.length + textSuffix.length)
    body.set(textPrefix, 0)
    body.set(fileBytes, textPrefix.length)
    body.set(textSuffix, textPrefix.length + fileBytes.length)

    const response = await fetch(
        `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body,
        }
    )

    if (!response.ok) {
        const error = await response.json()
        throw new Error(`Drive uploadFile failed: ${JSON.stringify(error)}`)
    }

    return await response.json()
}

async function listClientFiles(
    accessToken: string,
    folderId?: string,
    query?: string,
    pageSize = 100,
    pageToken?: string
): Promise<Record<string, unknown>> {
    const qParts: string[] = ['trashed = false']

    // Default to root-level items when no folderId specified
    qParts.push(`'${folderId || 'root'}' in parents`)

    if (query) {
        qParts.push(`name contains '${query}'`)
    }

    const params = new URLSearchParams({
        q: qParts.join(' and '),
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,thumbnailLink,parents)',
        orderBy: 'modifiedTime desc',
        pageSize: String(pageSize),
    })

    if (pageToken) {
        params.set('pageToken', pageToken)
    }

    const response = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(`Drive listFiles failed: ${JSON.stringify(error)}`)
    }

    return await response.json()
}

async function renameFile(
    accessToken: string,
    fileId: string,
    newName: string
): Promise<Record<string, unknown>> {
    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
    })
    if (!response.ok) {
        const error = await response.json()
        throw new Error(`Drive renameFile failed: ${JSON.stringify(error)}`)
    }
    return await response.json()
}

async function deleteFile(
    accessToken: string,
    fileId: string
): Promise<Record<string, unknown>> {
    // Move to trash instead of permanent delete
    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trashed: true }),
    })
    if (!response.ok) {
        const error = await response.json()
        throw new Error(`Drive deleteFile failed: ${JSON.stringify(error)}`)
    }
    return { success: true, fileId }
}

async function moveFile(
    accessToken: string,
    fileId: string,
    newParentId: string
): Promise<Record<string, unknown>> {
    // First get current parents
    const getRes = await fetch(`${DRIVE_API_BASE}/files/${fileId}?fields=parents`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!getRes.ok) throw new Error('Failed to get file parents')
    const fileData = await getRes.json()
    const previousParents = (fileData.parents || []).join(',')

    const response = await fetch(
        `${DRIVE_API_BASE}/files/${fileId}?addParents=${newParentId}&removeParents=${previousParents}&fields=id,name,parents`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    )
    if (!response.ok) {
        const error = await response.json()
        throw new Error(`Drive moveFile failed: ${JSON.stringify(error)}`)
    }
    return await response.json()
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(instrument("google-drive", async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload: DrivePayload = await req.json()
        const { action, workspaceId } = payload

        if (!workspaceId) {
            return new Response(
                JSON.stringify({ error: 'workspaceId is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabase = createSupabaseAdmin()
        const accessToken = await getValidToken(supabase, workspaceId)

        let result: Record<string, unknown>

        switch (action) {
            case 'createFolder': {
                const { folderName, parentFolderId } = payload as CreateFolderPayload
                if (!folderName) throw new Error('folderName is required')
                result = await createFolder(accessToken, folderName, parentFolderId)
                break
            }

            case 'uploadFile': {
                const { fileName, mimeType, base64Content, folderId } = payload as UploadFilePayload
                if (!fileName || !base64Content) throw new Error('fileName and base64Content are required')
                result = await uploadFile(accessToken, fileName, mimeType || 'application/octet-stream', base64Content, folderId)
                break
            }

            case 'listClientFiles': {
                const { folderId, query, pageSize, pageToken } = payload as ListFilesPayload
                result = await listClientFiles(accessToken, folderId, query, pageSize, pageToken)
                break
            }

            case 'renameFile': {
                const { fileId, newName } = payload as RenameFilePayload
                if (!fileId || !newName) throw new Error('fileId and newName are required')
                result = await renameFile(accessToken, fileId, newName)
                break
            }

            case 'deleteFile': {
                const { fileId } = payload as DeleteFilePayload
                if (!fileId) throw new Error('fileId is required')
                result = await deleteFile(accessToken, fileId)
                break
            }

            case 'moveFile': {
                const { fileId, newParentId } = payload as MoveFilePayload
                if (!fileId || !newParentId) throw new Error('fileId and newParentId are required')
                result = await moveFile(accessToken, fileId, newParentId)
                break
            }

            case 'downloadFile': {
                const { fileId } = payload as { action: string; workspaceId: string; fileId: string }
                if (!fileId) throw new Error('fileId is required')
                const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
                const dlRes = await fetch(downloadUrl, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                })
                if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`)
                const arrayBuf = await dlRes.arrayBuffer()
                const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)))
                // Get metadata for mimeType
                const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                })
                const meta = await metaRes.json()
                result = { content: base64, mimeType: meta.mimeType, name: meta.name, size: meta.size }
                break
            }

            default:
                return new Response(
                    JSON.stringify({ error: `Unknown action: ${action}. Available: createFolder, uploadFile, listClientFiles, renameFile, deleteFile, moveFile, downloadFile` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
        }

        return new Response(
            JSON.stringify({ success: true, data: result }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('google-drive error:', error)
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}))
