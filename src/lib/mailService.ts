/**
 * Mail Service - Loops.so Integration
 * 
 * This service handles transactional email sending via the Loops.so API.
 * Used for verification emails, password resets, and other transactional communications.
 */

const LOOPS_API_URL = 'https://app.loops.so/api/v1/transactional';
const LOOPS_API_KEY = import.meta.env.VITE_LOOPS_API_KEY;
const LOOPS_VERIFICATION_TEMPLATE_ID = import.meta.env.VITE_LOOPS_VERIFICATION_TEMPLATE_ID;

/**
 * Sends a verification email to a newly registered user via Loops.so
 * 
 * @param email - The recipient's email address
 * @returns Promise<boolean> - Returns true if email was sent successfully, false otherwise
 */
export async function sendVerificationEmail(email: string): Promise<boolean> {
    if (!LOOPS_API_KEY) {
        console.error('[MailService] VITE_LOOPS_API_KEY is not configured in environment variables');
        return false;
    }

    if (!LOOPS_VERIFICATION_TEMPLATE_ID) {
        console.error('[MailService] VITE_LOOPS_VERIFICATION_TEMPLATE_ID is not configured in environment variables');
        return false;
    }

    try {
        const response = await fetch(LOOPS_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LOOPS_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transactionalId: LOOPS_VERIFICATION_TEMPLATE_ID,
                email: email,
                // You can add additional data variables here if your Loops template uses them
                // dataVariables: {
                //   firstName: "User",
                // }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[MailService] Failed to send verification email:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData,
            });
            return false;
        }

        const result = await response.json();
        console.log('[MailService] Verification email sent successfully:', result);
        return true;

    } catch (error) {
        console.error('[MailService] Error sending verification email:', error);
        return false;
    }
}

/**
 * Generic function to send any transactional email via Loops.so
 * 
 * @param templateId - The Loops.so transactional template ID
 * @param email - The recipient's email address
 * @param dataVariables - Optional data variables for the template
 * @returns Promise<boolean> - Returns true if email was sent successfully
 */
export async function sendTransactionalEmail(
    templateId: string,
    email: string,
    dataVariables?: Record<string, string>
): Promise<boolean> {
    if (!LOOPS_API_KEY) {
        console.error('[MailService] VITE_LOOPS_API_KEY is not configured');
        return false;
    }

    try {
        const response = await fetch(LOOPS_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LOOPS_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transactionalId: templateId,
                email: email,
                ...(dataVariables && { dataVariables }),
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[MailService] Failed to send transactional email:', errorData);
            return false;
        }

        return true;

    } catch (error) {
        console.error('[MailService] Error sending transactional email:', error);
        return false;
    }
}
