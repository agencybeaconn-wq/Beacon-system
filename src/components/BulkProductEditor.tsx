import React, { useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { Upload, Download, Plus, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileSpreadsheet, Filter, Clock, X, CheckCircle2, AlertCircle, Undo2, Play, Store, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShopify } from '@/hooks/useShopifyConnection';
import { useDashboard } from '@/contexts/DashboardContext';
import type { HandleChange } from '@/services/shopifyService';

// ─── Shared Types (inlined) ──────────────────────────────────────────────

export type Operator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'does_not_contain'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than';

export type EditActionType =
  | 'add_beginning'
  | 'add_end'
  | 'find_replace'
  | 'remove_text'
  | 'change_case'
  | 'set_to'
  | 'increase_by_amount'
  | 'decrease_by_amount'
  | 'increase_by_percent'
  | 'decrease_by_percent';

export type VariantEditAction =
  | 'vo_replace_value'
  | 'vo_remove_value'
  | 'vo_case_value'
  | 'vo_set_value'
  | 'vo_replace_name'
  | 'vo_remove_name'
  | 'vo_case_name'
  | 'vo_set_name'
  | 'vo_delete_option_value'
  | 'vo_add_variant_value'
  | 'vo_add_new_option'
  | 'vo_delete_variant';

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface VariantFilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface ShopifyProduct {
  [key: string]: string;
}

export interface GroupedProduct {
  handle: string;
  title: string;
  vendor: string;
  type: string;
  tags: string;
  rows: ShopifyProduct[];
}

// ─── Types ────────────────────────────────────────────────────────────────

interface TaskHistoryItem {
  id: string;
  timestamp: Date;
  fileName: string;
  targetField: string;
  targetFieldLabel: string;
  actionType: EditActionType;
  actionLabel: string;
  actionParams: Record<string, any>;
  productCount: number;
  variantCount: number | null;
  conditions: FilterCondition[];
  variantConditions: VariantFilterCondition[] | null;
  status: 'success' | 'error';
}

// ─── Constants ────────────────────────────────────────────────────────────

const OPERATORS: { value: Operator; label: string }[] = [
  { value: 'is', label: 'é igual a' },
  { value: 'is_not', label: 'não é igual a' },
  { value: 'contains', label: 'contém' },
  { value: 'does_not_contain', label: 'não contém' },
  { value: 'starts_with', label: 'começa com' },
  { value: 'ends_with', label: 'termina com' },
  { value: 'greater_than', label: 'maior que' },
  { value: 'less_than', label: 'menor que' },
];

const EDITABLE_FIELDS = [
  { value: 'Title', label: 'Título' },
  { value: 'Body (HTML)', label: 'Descrição (Body HTML)' },
  { value: 'Variant Price', label: 'Preço' },
  { value: 'Variant Compare At Price', label: 'Preço de Comparação' },
  { value: 'Tags', label: 'Tags' },
  { value: 'Vendor', label: 'Vendedor' },
  { value: 'Variant Inventory Qty', label: 'Quantidade' },
  { value: 'Variant Inventory Policy', label: 'Política de Inventário' },
  { value: 'variants_options', label: 'Variantes e Opções' },
];

const PRODUCT_EDITABLE_FIELDS = [
  { value: 'Title', label: 'Título' },
  { value: 'Body (HTML)', label: 'Descrição (Body HTML)' },
  { value: 'Tags', label: 'Tags' },
  { value: 'Vendor', label: 'Vendedor' },
  { value: 'Type', label: 'Tipo de Produto' },
];

const PRICE_EDITABLE_FIELDS = [
  { value: 'Variant Price', label: 'Preço' },
  { value: 'Variant Compare At Price', label: 'Preço de Comparação' },
];

const INVENTORY_EDITABLE_FIELDS = [
  { value: 'Variant Inventory Qty', label: 'Quantidade' },
  { value: 'Variant Inventory Policy', label: 'Política de Inventário' },
];

const SEO_EDITABLE_FIELDS = [
  { value: 'seo_meta_title', label: 'Meta Title (SEO)' },
  { value: 'seo_meta_description', label: 'Meta Description (SEO)' },
  { value: 'seo_handle', label: 'URL Handle (SEO)' },
];

const SEO_TITLE_TEMPLATES = [
  { value: '[product_title]', label: '[product_title]' },
  { value: '[product_title] | [shop_name]', label: '[product_title] | [shop_name]' },
  { value: '[product_title] - [product_vendor]', label: '[product_title] - [product_vendor]' },
  { value: '[product_title] | [price]', label: '[product_title] | [price]' },
];

const SEO_DESCRIPTION_TEMPLATES = [
  { value: '[product_title]. [product_type]', label: '[product_title]. [product_type]' },
  { value: 'Compre [product_title] com melhor preço. [shop_name]', label: 'Compre [product_title] com melhor preço. [shop_name]' },
  { value: '[product_title] - [product_type]. Preço: [price]', label: '[product_title] - [product_type]. Preço: [price]' },
];

const SEO_HANDLE_TEMPLATES = [
  { value: '[product_title]', label: '[product_title]' },
  { value: '[product_title]-[product_type]', label: '[product_title]-[product_type]' },
  { value: '[product_title]-[barcode]', label: '[product_title]-[barcode]' },
];

const VARIANT_COMPOUND_ACTIONS: { value: VariantEditAction; label: string }[] = [
  { value: 'vo_replace_value', label: 'Substituir texto no valor da variante' },
  { value: 'vo_remove_value', label: 'Remover texto do valor da variante' },
  { value: 'vo_case_value', label: 'Alterar maiúsculas/minúsculas do valor' },
  { value: 'vo_set_value', label: 'Definir novo valor da variante' },
  { value: 'vo_replace_name', label: 'Substituir texto no nome da opção' },
  { value: 'vo_remove_name', label: 'Remover texto do nome da opção' },
  { value: 'vo_case_name', label: 'Alterar maiúsculas/minúsculas do nome' },
  { value: 'vo_set_name', label: 'Definir novo nome da opção' },
  { value: 'vo_delete_option_value', label: 'Remover opção do produto' },
  { value: 'vo_add_variant_value', label: 'Adicionar novo valor de variante' },
  { value: 'vo_add_new_option', label: 'Adicionar nova opção ao produto' },
  { value: 'vo_delete_variant', label: 'Remover variantes por valor' },
];

const PRODUCT_LEVEL_FIELDS = ['Title', 'Body (HTML)', 'Tags', 'Vendor', 'Type', 'Handle', 'Option1 Name', 'Option2 Name', 'Option3 Name'];

const PRODUCT_COLUMN_LABELS: [string, string][] = [
  ['Status', 'Status'],
  ['Vendor', 'Vendedor'],
  ['Type', 'Tipo'],
  ['Tags', 'Tags'],
  ['Body (HTML)', 'Descrição'],
];

const VARIANT_COLUMN_LABELS: [string, string][] = [
  ['Variant Price', 'Preço'],
  ['Variant Compare At Price', 'Preço Comp.'],
  ['Variant Inventory Qty', 'Estoque'],
  ['Variant Inventory Policy', 'Política Estoque'],
  ['Variant SKU', 'SKU'],
  ['Variant Grams', 'Peso (g)'],
  ['Variant Weight Unit', 'Un. Peso'],
  ['Variant Barcode', 'Cód. Barras'],
  ['Variant Image', 'Imagem'],
  ['Variant Taxable', 'Tributável'],
  ['Variant Tax Code', 'Cód. Imposto'],
  ['Variant Fulfillment Service', 'Serv. Fulfillment'],
  ['Variant Requires Shipping', 'Requer Envio'],
];

// Field to table columns mapping - determines what columns to show for each field being edited
const FIELD_COLUMN_MAPPING: Record<string, string[]> = {
  'Title': ['title', 'description'],
  'Body (HTML)': ['title', 'description'],
  'Variant Price': ['title', 'price'],
  'Variant Compare At Price': ['title', 'price'],
  'Tags': ['title', 'tags'],
  'Vendor': ['title', 'vendor'],
  'Variant Inventory Qty': ['title', 'inventory'],
  'Variant Inventory Policy': ['title', 'inventory'],
  'variants_options': ['title', 'variants'],
  'seo_meta_title': ['title'],
  'seo_meta_description': ['title'],
  'seo_handle': ['title'],
};

const FILTERABLE_FIELDS = [
  ...EDITABLE_FIELDS,
  { value: 'Handle', label: 'Handle (URL)' },
  { value: 'Option1 Name', label: 'Opção 1 (Nome)' },
  { value: 'Option1 Value', label: 'Opção 1 (Valor)' },
  { value: 'Option2 Name', label: 'Opção 2 (Nome)' },
  { value: 'Option2 Value', label: 'Opção 2 (Valor)' },
  { value: 'Option3 Name', label: 'Opção 3 (Nome)' },
  { value: 'Option3 Value', label: 'Opção 3 (Valor)' },
  { value: 'Variant SKU', label: 'SKU' },
  { value: 'Variant Inventory Qty', label: 'Quantidade' },
  { value: 'Status', label: 'Status' },
];


const TEXT_ACTIONS: { value: EditActionType; label: string }[] = [
  { value: 'add_beginning', label: 'adicionar texto no início' },
  { value: 'add_end', label: 'adicionar texto no final' },
  { value: 'find_replace', label: 'localizar e substituir texto' },
  { value: 'remove_text', label: 'localizar e remover texto' },
  { value: 'change_case', label: 'alterar maiúsculas/minúsculas' },
  { value: 'set_to', label: 'definir um novo valor' },
];

const NUMBER_ACTIONS: { value: EditActionType; label: string }[] = [
  { value: 'increase_by_amount', label: 'aumentar por valor fixo' },
  { value: 'decrease_by_amount', label: 'diminuir por valor fixo' },
  { value: 'increase_by_percent', label: 'aumentar por porcentagem (%)' },
  { value: 'decrease_by_percent', label: 'diminuir por porcentagem (%)' },
  { value: 'set_to', label: 'definir um novo valor' },
];

const LIST_ACTIONS: { value: EditActionType; label: string }[] = [
  { value: 'add_end', label: 'adicionar novo (no final)' },
  { value: 'set_to', label: 'definir um novo valor substituto' },
  { value: 'remove_text', label: 'remover um item específico' },
  { value: 'find_replace', label: 'localizar e substituir' },
];

const ITEMS_PER_PAGE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────

function matchesCondition(cellValue: string, operator: Operator, filterValue: string): boolean {
  const cell = cellValue.toLowerCase();
  const filter = filterValue.toLowerCase();

  switch (operator) {
    case 'is': return cell === filter;
    case 'is_not': return cell !== filter;
    case 'contains': return cell.includes(filter);
    case 'does_not_contain': return !cell.includes(filter);
    case 'starts_with': return cell.startsWith(filter);
    case 'ends_with': return cell.endsWith(filter);
    case 'greater_than': return parseFloat(cellValue) > parseFloat(filterValue);
    case 'less_than': return parseFloat(cellValue) < parseFloat(filterValue);
    default: return true;
  }
}

function groupByHandle(rows: ShopifyProduct[]): GroupedProduct[] {
  const map = new Map<string, ShopifyProduct[]>();
  const order: string[] = [];

  for (const row of rows) {
    const handle = row.Handle || '';
    if (handle) {
      if (!map.has(handle)) {
        map.set(handle, []);
        order.push(handle);
      }
      map.get(handle)!.push(row);
    } else {
      const lastHandle = order[order.length - 1];
      if (lastHandle) {
        map.get(lastHandle)!.push(row);
      }
    }
  }

  return order.map((handle) => {
    const productRows = map.get(handle)!;
    const first = productRows[0];
    return {
      handle,
      title: first.Title || '',
      vendor: first.Vendor || '',
      type: first.Type || '',
      tags: first.Tags || '',
      rows: productRows,
    };
  });
}

/**
 * Determines if a row is the "first row" of a product group.
 * In Shopify CSVs, the first row of a product has Title filled in.
 * Variant-only rows have Title empty.
 */
function isFirstRowOfProduct(row: ShopifyProduct): boolean {
  return !!row.Title;
}

function isProductLevelField(field: string): boolean {
  return PRODUCT_LEVEL_FIELDS.includes(field);
}

function getPriceRange(rows: ShopifyProduct[]): string {
  const prices = rows
    .map((r) => parseFloat(r['Variant Price']))
    .filter((p) => !isNaN(p));
  if (!prices.length) return '-';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `R$ ${min.toFixed(2)}`;
  return `R$ ${min.toFixed(2)} - R$ ${max.toFixed(2)}`;
}

function applyAction(currentValue: string, action: EditActionType, params: Record<string, any>): string {
  switch (action) {
    case 'add_beginning':
      if (!params.text) return currentValue;
      return `${params.text} ${currentValue}`;
    case 'add_end':
      if (!params.text) return currentValue;
      return `${currentValue} ${params.text}`;
    case 'find_replace':
      return currentValue.split(params.find || '').join(params.replace || '');
    case 'remove_text':
      return currentValue.split(params.text || '').join('');
    case 'change_case':
      if (params.case === 'uppercase') return currentValue.toUpperCase();
      if (params.case === 'lowercase') return currentValue.toLowerCase();
      return currentValue;
    case 'set_to':
      return params.text || '';
    case 'increase_by_amount': {
      const num = parseFloat(currentValue) || 0;
      const inc = parseFloat(params.amount) || 0;
      return (num + inc).toFixed(2);
    }
    case 'decrease_by_amount': {
      const num = parseFloat(currentValue) || 0;
      const dec = parseFloat(params.amount) || 0;
      return Math.max(0, num - dec).toFixed(2);
    }
    case 'increase_by_percent': {
      const num = parseFloat(currentValue) || 0;
      const pct = parseFloat(params.percent) || 0;
      return (num * (1 + pct / 100)).toFixed(2);
    }
    case 'decrease_by_percent': {
      const num = parseFloat(currentValue) || 0;
      const pct = parseFloat(params.percent) || 0;
      return Math.max(0, num * (1 - pct / 100)).toFixed(2);
    }
    default:
      return currentValue;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getActionDescription(actionType: EditActionType, params: Record<string, any>, isPriceField: boolean): string {
  if (params._description) return params._description;
  switch (actionType) {
    case 'add_beginning': return `Adicionar "${params.text}" no início`;
    case 'add_end': return `Adicionar "${params.text}" no final`;
    case 'find_replace': return `Substituir "${params.find}" por "${params.replace}"`;
    case 'remove_text': return `Remover "${params.text}"`;
    case 'change_case': return params.case === 'uppercase' ? 'MAIÚSCULAS' : 'minúsculas';
    case 'set_to': return isPriceField ? `Definir R$ ${params.text}` : `Definir "${params.text}"`;
    case 'increase_by_amount': return `+R$ ${params.amount}`;
    case 'decrease_by_amount': return `-${params.amount}`;
    case 'increase_by_percent': return `+${params.percent}%`;
    case 'decrease_by_percent': return `-${params.percent}%`;
    default: return '';
  }
}

// ─── IndexedDB Helper ─────────────────────────────────────────────────────

const DB_NAME = 'BulkEditorDB';
const STORE_NAME = 'editor_store';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const idbSet = async (key: string, value: any): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IDB Set Error:', e);
  }
};

const idbGet = async (key: string): Promise<any> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IDB Get Error:', e);
    return null;
  }
};

const idbRemove = async (key: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IDB Remove Error:', e);
  }
};

// ─── App ──────────────────────────────────────────────────────────────────

export default function BulkProductEditor() {
  // ─── File data ──────────────────────────────────────────────────────
  const [data, setData] = useState<ShopifyProduct[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Client context for per-client Shopify credentials
  const { selectedClientId, clientData, selectedClientName } = useDashboard();

  // Check if selected client has Shopify connected
  const isShopifyConnected = (clientData as any)?.shopify_status === 'connected';
  const shopifyShopName = (clientData as any)?.shopify_shop_name || null;

  // Shopify integration (per-client)
  const shopify = useShopify(selectedClientId ?? undefined);

  // Step 1: Product filters
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: '1', field: 'Title', operator: 'contains', value: '' },
  ]);

  // Target field to edit
  const [targetField, setTargetField] = useState<string>('Title');

  // Optional step: Variant filters
  const [useVariantFilter, setUseVariantFilter] = useState(false);
  const [variantConditions, setVariantConditions] = useState<VariantFilterCondition[]>([
    { id: 'v1', field: 'Any Option Value', operator: 'contains', value: '' },
  ]);

  // Step 3: Edit action
  const [actionType, setActionType] = useState<EditActionType>('add_beginning');
  const [actionParams, setActionParams] = useState<Record<string, any>>({ text: '' });

  // Variant-specific state
  const [variantAction, setVariantAction] = useState<VariantEditAction>('vo_replace_value');
  const [selectedOptionName, setSelectedOptionName] = useState<string>('');

  // Preview state
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [recentlyEdited, setRecentlyEdited] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [focusedView, setFocusedView] = useState(true); // true = visão focada, false = visão geral

  // Task history
  const [taskHistory, setTaskHistory] = useState<TaskHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Sidebar states
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  // ─── IndexedDB Persistence ──────────────────────────────────────
  React.useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedData = await idbGet('bt_editor_data');
        if (savedData) setData(savedData);

        const savedHeaders = await idbGet('bt_editor_headers');
        if (savedHeaders) setHeaders(savedHeaders);

        const savedFileName = await idbGet('bt_editor_filename');
        if (savedFileName) setFileName(savedFileName);

        const savedHistory = await idbGet('bt_editor_history');
        if (savedHistory) setTaskHistory(savedHistory);
      } catch (e) {
        console.error('Failed to load storage data:', e);
      }
    };
    loadSavedData();
  }, []);

  React.useEffect(() => {
    if (data.length > 0) {
      idbSet('bt_editor_data', data);
      idbSet('bt_editor_headers', headers);
      if (fileName) idbSet('bt_editor_filename', fileName);
    } else {
      idbRemove('bt_editor_data');
      idbRemove('bt_editor_headers');
      idbRemove('bt_editor_filename');
    }
  }, [data, headers, fileName]);

  React.useEffect(() => {
    if (taskHistory.length > 0) {
      idbSet('bt_editor_history', taskHistory);
    } else {
      idbRemove('bt_editor_history');
    }
  }, [taskHistory]);

  // ─── File upload ────────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setCurrentPage(0);
    setExpandedProducts(new Set());

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setData(results.data as ShopifyProduct[]);
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
        }
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        alert('Falha ao processar o arquivo CSV.');
      },
    });
  };

  // ─── Grouped products ──────────────────────────────────────────────

  const groupedProducts = useMemo(() => groupByHandle(data), [data]);

  // ─── Step 1: Filter products ───────────────────────────────────────

  const addCondition = () => {
    setConditions([
      ...conditions,
      { id: Math.random().toString(36).substr(2, 9), field: 'Title', operator: 'contains', value: '' },
    ]);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, key: keyof FilterCondition, value: string) => {
    setConditions(conditions.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
  };

  const filteredProducts = useMemo(() => {
    if (!groupedProducts.length) return [];

    return groupedProducts.filter((product) => {
      return conditions.every((condition) => {
        if (!condition.value) return true;

        const field = condition.field;

        if (isProductLevelField(field)) {
          const cellValue = String(product.rows[0][field] || '');
          return matchesCondition(cellValue, condition.operator as Operator, condition.value);
        } else {
          return product.rows.some((row) => {
            const cellValue = String(row[field] || '');
            return matchesCondition(cellValue, condition.operator as Operator, condition.value);
          });
        }
      });
    });
  }, [groupedProducts, conditions]);

  React.useEffect(() => {
    setCurrentPage(0);
  }, [filteredProducts.length]);

  // ─── Optional step: Variant filter ─────────────────────────────────

  const addVariantCondition = () => {
    setVariantConditions([
      ...variantConditions,
      { id: 'v' + Math.random().toString(36).substr(2, 9), field: 'Any Option Value', operator: 'contains', value: '' },
    ]);
  };

  const removeVariantCondition = (id: string) => {
    setVariantConditions(variantConditions.filter((c) => c.id !== id));
  };

  const updateVariantCondition = (id: string, key: keyof VariantFilterCondition, value: string) => {
    setVariantConditions(variantConditions.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
  };

  const doesRowMatchVariantFilter = useCallback(
    (row: ShopifyProduct): boolean => {
      if (!useVariantFilter) return true;
      return variantConditions.every((condition) => {
        if (!condition.value) return true;

        if (condition.field === 'Any Option Value') {
          const v1 = String(row['Option1 Value'] || '');
          const v2 = String(row['Option2 Value'] || '');
          const v3 = String(row['Option3 Value'] || '');

          const m1 = matchesCondition(v1, condition.operator as Operator, condition.value);
          const m2 = matchesCondition(v2, condition.operator as Operator, condition.value);
          const m3 = matchesCondition(v3, condition.operator as Operator, condition.value);

          if (condition.operator === 'is_not' || condition.operator === 'does_not_contain') {
            return m1 && m2 && m3;
          } else {
            return m1 || m2 || m3;
          }
        }

        const cellValue = String(row[condition.field] || '');
        return matchesCondition(cellValue, condition.operator as Operator, condition.value);
      });
    },
    [useVariantFilter, variantConditions]
  );

  const dynamicVariantFields = useMemo(() => {
    return [
      { value: 'Any Option Value', label: 'Valor da Opção' },
      { value: 'Variant Price', label: 'Preço da Variante' },
      { value: 'Variant Compare At Price', label: 'Preço de Comparação' },
      { value: 'Variant SKU', label: 'SKU' },
      { value: 'Variant Barcode', label: 'Código de Barras' },
    ];
  }, []);

  // ─── Preview pagination ────────────────────────────────────────────

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(
    () => filteredProducts.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage),
    [filteredProducts, currentPage, itemsPerPage]
  );

  const toggleExpand = (handle: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  };

  // Detect real option names from filtered products
  const realOptionNames = useMemo(() => {
    const names = new Set<string>();
    for (const product of filteredProducts) {
      for (let n = 1; n <= 3; n++) {
        const nameKey = `Option${n} Name`;
        if (product.rows[0]?.[nameKey]) {
          names.add(product.rows[0][nameKey]);
        }
      }
    }
    return Array.from(names).sort();
  }, [filteredProducts]);

  // Detect real values for a specific option name
  const getRealOptionValues = useCallback((optionName: string): string[] => {
    const values = new Set<string>();
    for (const product of filteredProducts) {
      for (let n = 1; n <= 3; n++) {
        const nameKey = `Option${n} Name`;
        const valKey = `Option${n} Value`;
        if (product.rows[0]?.[nameKey] === optionName) {
          for (const row of product.rows) {
            const val = row[valKey];
            if (val) values.add(val);
          }
        }
      }
    }
    return Array.from(values).sort();
  }, [filteredProducts]);

  const isVariantsMode = targetField === 'variants_options';
  const isSEOMode = targetField.startsWith('seo_');

  // Determine which columns to show based on the field being edited
  // Resolve the actual CSV column from variant action + option name
  const resolvedTargetField = useMemo(() => {
    if (!isVariantsMode || !selectedOptionName) return targetField;
    const isNameAction = variantAction.includes('_name');
    // Find which Option column has this name
    for (const product of filteredProducts) {
      for (let n = 1; n <= 3; n++) {
        const nameKey = `Option${n} Name`;
        if (product.rows[0]?.[nameKey] === selectedOptionName) {
          return `Option${n} ${isNameAction ? 'Name' : 'Value'}`;
        }
      }
    }
    return targetField;
  }, [isVariantsMode, targetField, variantAction, selectedOptionName, filteredProducts]);

  // Resolve the actual EditActionType from the compound variant action
  const resolvedActionType = useMemo((): EditActionType => {
    if (!isVariantsMode) return actionType;
    if (variantAction.includes('replace')) return 'find_replace';
    if (variantAction.includes('remove')) return 'remove_text';
    if (variantAction.includes('case')) return 'change_case';
    return 'set_to';
  }, [isVariantsMode, actionType, variantAction]);

  const isPriceField = resolvedTargetField.toLowerCase().includes('price');
  const isInventoryQtyField = resolvedTargetField === 'Variant Inventory Qty';
  const isInventorySelectField = resolvedTargetField === 'Variant Inventory Policy' || resolvedTargetField === 'Variant Inventory Tracker';
  const isVariantLevelField = !isProductLevelField(resolvedTargetField);
  const isListField = ['Tags', 'Vendor', 'Type'].includes(resolvedTargetField);

  // Adaptive columns based on focused view and field being edited
  const visibleColumns = useMemo(() => {
    const cols = ['expand', 'title']; // sempre mostrar estes

    if (!focusedView) {
      // Visão geral - mostrar tudo
      return ['expand', 'title', 'price', 'status', 'vendor', 'tags', 'description', 'variants'];
    }

    // Visão focada - mostrar apenas relevantes baseado no campo
    const mappedColumns = FIELD_COLUMN_MAPPING[resolvedTargetField] || FIELD_COLUMN_MAPPING[targetField] || [];

    for (const col of mappedColumns) {
      if (!cols.includes(col)) {
        cols.push(col);
      }
    }

    // Se não tem colunas mapeadas, mostrar preço como padrão
    if (cols.length === 1) {
      cols.push('price');
    }

    return cols;
  }, [focusedView, resolvedTargetField, targetField]);

  // Dynamic option names from CSV data
  const optionNames = useMemo(() => {
    const getNames = (key: string) => {
      const names = new Set(data.filter(r => r[key]).map(r => r[key]));
      return Array.from(names).join(' / ');
    };
    return {
      1: getNames('Option1 Name') || 'Opção 1',
      2: getNames('Option2 Name') || 'Opção 2',
      3: getNames('Option3 Name') || 'Opção 3',
    };
  }, [data]);

  // Check which options actually exist in the data
  const availableOptions = useMemo(() => {
    const opts: (1 | 2 | 3)[] = [1];
    if (data.some(r => r['Option2 Name'])) opts.push(2);
    if (data.some(r => r['Option3 Name'])) opts.push(3);
    return opts;
  }, [data]);

  const isStructuralVariantAction = isVariantsMode &&
    (variantAction === 'vo_delete_option_value' || variantAction === 'vo_add_variant_value' || variantAction === 'vo_add_new_option' || variantAction === 'vo_delete_variant');

  // All distinct option NAMES across filtered products (for structural actions)
  const distinctOptionNames = useMemo(() => {
    if (!isStructuralVariantAction) return [];
    const names = new Set<string>();
    for (const product of filteredProducts) {
      const first = product.rows[0];
      if (first?.['Option1 Name']?.trim()) names.add(first['Option1 Name'].trim());
      if (first?.['Option2 Name']?.trim()) names.add(first['Option2 Name'].trim());
      if (first?.['Option3 Name']?.trim()) names.add(first['Option3 Name'].trim());
    }
    return Array.from(names).sort();
  }, [filteredProducts, isStructuralVariantAction]);

  // Distinct values for the selected option NAME (looking up the correct column per product)
  const distinctOptionValues = useMemo(() => {
    if (!isStructuralVariantAction || !actionParams.optionName) return [];
    const selectedName = actionParams.optionName;
    const values = new Set<string>();
    for (const product of filteredProducts) {
      const first = product.rows[0];
      let optKey: string | null = null;
      if (first?.['Option1 Name']?.trim() === selectedName) optKey = 'Option1 Value';
      else if (first?.['Option2 Name']?.trim() === selectedName) optKey = 'Option2 Value';
      else if (first?.['Option3 Name']?.trim() === selectedName) optKey = 'Option3 Value';
      if (!optKey) continue;
      for (const row of product.rows) {
        const val = row[optKey]?.trim();
        if (val) values.add(val);
      }
    }
    return Array.from(values).sort();
  }, [filteredProducts, isStructuralVariantAction, actionParams.optionName]);

  const getFieldLabel = useCallback((fieldValue: string) => {
    if (fieldValue === 'variants_options') {
      const actionLabel = VARIANT_COMPOUND_ACTIONS.find(a => a.value === variantAction)?.label || '';
      return selectedOptionName ? `${actionLabel} — ${selectedOptionName}` : actionLabel;
    }
    return EDITABLE_FIELDS.find((f) => f.value === fieldValue)?.label || fieldValue;
  }, [variantAction, selectedOptionName]);

  const availableActions = useMemo(() => {
    if (isVariantsMode) return []; // handled by variant action dropdown
    if (isPriceField || isInventoryQtyField) return NUMBER_ACTIONS;
    if (isInventorySelectField) return [
      { value: 'set_to', label: 'definir novo valor' },
    ] as typeof TEXT_ACTIONS;
    if (targetField === 'Vendor') return [
      { value: 'set_to', label: 'definir novo vendedor' },
      { value: 'find_replace', label: 'localizar e substituir vendedor' },
      { value: 'remove_text', label: 'remover nome do vendedor' }
    ] as typeof TEXT_ACTIONS;
    if (targetField === 'Tags') return [
      { value: 'add_end', label: 'adicionar tag(s)' },
      { value: 'set_to', label: 'substituir todas as tags por' },
      { value: 'remove_text', label: 'remover tag(s) específica(s)' },
      { value: 'find_replace', label: 'localizar e substituir tag' }
    ] as typeof TEXT_ACTIONS;
    return TEXT_ACTIONS;
  }, [targetField, isPriceField, isInventoryQtyField, isInventorySelectField, isVariantsMode]);

  const prevTargetFieldRef = React.useRef(targetField);
  React.useEffect(() => {
    const justSwitched = prevTargetFieldRef.current !== targetField;
    prevTargetFieldRef.current = targetField;

    if (isVariantsMode) {
      // Only reset params when first entering variants mode
      if (justSwitched) setActionParams({});
    } else if (isInventorySelectField) {
      setActionType('set_to');
      if (justSwitched) {
        setActionParams({ text: targetField === 'Variant Inventory Policy' ? 'deny' : 'shopify' });
      }
    } else if ((isPriceField || isInventoryQtyField) && !NUMBER_ACTIONS.some((a) => a.value === actionType)) {
      setActionType('increase_by_amount');
      setActionParams({ amount: '' });
    } else if (targetField === 'Vendor' && !availableActions.some((a) => a.value === actionType)) {
      setActionType('set_to');
      setActionParams({ text: '' });
    } else if (!isPriceField && !isInventoryQtyField && !isListField && !TEXT_ACTIONS.some((a) => a.value === actionType)) {
      setActionType('add_beginning');
      setActionParams({ text: '' });
    }
  }, [targetField, isPriceField, isInventoryQtyField, isInventorySelectField, isListField, actionType]);

  // ─── Execute edit (in-memory) ───────────────────────────────────────

  // Keep history of data snapshots for undo
  const [dataHistory, setDataHistory] = useState<ShopifyProduct[][]>([]);

  const handleExecute = () => {
    if (!data.length || !filteredProducts.length) return;

    // Save current state for undo
    setDataHistory((prev) => [...prev, data]);

    const matchedHandles = new Set(filteredProducts.map((p) => p.handle));
    let editedVariantCount = 0;
    let modifiedData: ShopifyProduct[];

    // ─── Structural variant actions (add/remove option) ──────────────
    if (isStructuralVariantAction) {
      const selectedName = (actionParams.optionName || '').trim();

      if (!selectedName) {
        setDataHistory((prev) => prev.slice(0, -1));
        return;
      }

      // Helper: find which Option number (1/2/3) has this name for a given product
      const findOptNum = (firstRow: ShopifyProduct): number | null => {
        if (firstRow?.['Option1 Name']?.trim() === selectedName) return 1;
        if (firstRow?.['Option2 Name']?.trim() === selectedName) return 2;
        if (firstRow?.['Option3 Name']?.trim() === selectedName) return 3;
        return null;
      };

      const grouped = groupByHandle(data);

      if (variantAction === 'vo_delete_option_value') {
        // Remove the entire option column, shift remaining options, deduplicate rows
        const newData: ShopifyProduct[] = [];

        for (const group of grouped) {
          if (!matchedHandles.has(group.handle)) {
            newData.push(...group.rows);
            continue;
          }

          const optNum = findOptNum(group.rows[0]);
          if (!optNum) {
            newData.push(...group.rows);
            continue;
          }

          // Step 1: For each row, shift option columns and build the new option values
          const shiftedRows: ShopifyProduct[] = group.rows.map((row) => {
            const newRow = { ...row };
            // Shift higher options down to fill the removed one
            for (let n = optNum; n <= 3; n++) {
              if (n < 3) {
                newRow[`Option${n} Name`] = row[`Option${n + 1} Name`] || '';
                newRow[`Option${n} Value`] = row[`Option${n + 1} Value`] || '';
              } else {
                newRow[`Option${n} Name`] = '';
                newRow[`Option${n} Value`] = '';
              }
            }
            return newRow;
          });

          // Step 2: Deduplicate by remaining option values, keeping the FIRST occurrence
          // (which preserves the variant data: price, SKU, barcode, images, etc.)
          const processedRows: ShopifyProduct[] = [];
          const seenKeys = new Map<string, number>(); // key → index in processedRows

          for (const row of shiftedRows) {
            const key = [
              row['Option1 Value'] || '',
              row['Option2 Value'] || '',
              row['Option3 Value'] || '',
            ].join('|||');

            if (seenKeys.has(key)) {
              editedVariantCount++;
              continue;
            }
            seenKeys.set(key, processedRows.length);
            processedRows.push(row);
          }

          // Step 3: Fix row structure — only first row keeps product-level data
          if (processedRows.length > 0) {
            const original = group.rows[0];

            // First row inherits ALL product-level fields from original first row
            processedRows[0].Handle = original.Handle;
            for (const field of PRODUCT_LEVEL_FIELDS) {
              if (field.startsWith('Option')) continue; // Already handled by shift
              processedRows[0][field] = original[field] || '';
            }
            // Also preserve other product-level CSV fields
            for (const extraField of ['Published', 'Status', 'Image Src', 'Image Position', 'Image Alt Text']) {
              if (original[extraField]) {
                processedRows[0][extraField] = original[extraField];
              }
            }

            // Fix the Option Names on the first row (shift applied correctly above)
            // But ensure Names come from the original first row's shifted values
            const origFirst = shiftedRows[0];
            for (let n = 1; n <= 3; n++) {
              processedRows[0][`Option${n} Name`] = origFirst[`Option${n} Name`] || '';
            }

            // Clear product-level fields and Handle from non-first rows
            for (let i = 1; i < processedRows.length; i++) {
              processedRows[i].Handle = '';
              processedRows[i].Title = '';
              processedRows[i]['Body (HTML)'] = '';
              processedRows[i].Vendor = '';
              processedRows[i].Type = '';
              processedRows[i].Tags = '';
              processedRows[i].Published = '';
              processedRows[i].Status = '';
              for (let n = 1; n <= 3; n++) {
                processedRows[i][`Option${n} Name`] = '';
              }
            }
          }

          editedVariantCount += group.rows.length - processedRows.length;
          newData.push(...processedRows);
        }

        modifiedData = newData;
      } else if (variantAction === 'vo_delete_variant') {
        // Remove variant rows matching selected option values
        const selectedValues = new Set((actionParams.deleteValues as string[] || []));
        if (selectedValues.size === 0) {
          setDataHistory((prev) => prev.slice(0, -1));
          return;
        }

        const selectedName = actionParams.optionName || '';
        const newData: ShopifyProduct[] = [];

        for (const group of grouped) {
          if (!matchedHandles.has(group.handle)) {
            newData.push(...group.rows);
            continue;
          }

          const optNum = findOptNum(group.rows[0]);
          if (!optNum) {
            newData.push(...group.rows);
            continue;
          }

          const optKey = `Option${optNum} Value`;
          const keptRows: ShopifyProduct[] = [];

          for (const row of group.rows) {
            const val = row[optKey]?.trim() || '';
            if (selectedValues.has(val)) {
              editedVariantCount++;
              continue; // Remove this variant row
            }
            keptRows.push({ ...row });
          }

          // Ensure first kept row has product-level data
          if (keptRows.length > 0) {
            const original = group.rows[0];
            keptRows[0].Handle = original.Handle;
            for (const field of PRODUCT_LEVEL_FIELDS) {
              if (field.startsWith('Option') && field.includes('Name')) {
                keptRows[0][field] = original[field] || '';
              } else {
                keptRows[0][field] = original[field] || '';
              }
            }
            // Clear handle from non-first rows
            for (let i = 1; i < keptRows.length; i++) {
              keptRows[i].Handle = '';
            }
          }

          newData.push(...keptRows);
        }

        modifiedData = newData;
      } else if (variantAction === 'vo_add_variant_value') {
        // Add a new variant value to an existing option (e.g. add "2GG" to "Tamanho" after "GG")
        const newValue = (actionParams.text || '').trim();
        const afterValue = (actionParams.afterValue || '').trim(); // Position: insert after this value
        if (!newValue) { setDataHistory((prev) => prev.slice(0, -1)); return; }

        const newData: ShopifyProduct[] = [];

        for (const group of grouped) {
          if (!matchedHandles.has(group.handle)) { newData.push(...group.rows); continue; }

          const optNum = findOptNum(group.rows[0]);
          if (!optNum) { newData.push(...group.rows); continue; }

          const optKey = `Option${optNum} Value`;

          // Check if value already exists
          if (group.rows.some(r => r[optKey]?.trim() === newValue)) { newData.push(...group.rows); continue; }

          // Find the "after" row to clone as template (inherits price, weight, etc)
          const afterRow = afterValue
            ? group.rows.find(r => r[optKey]?.trim() === afterValue)
            : group.rows[group.rows.length - 1];
          const template = afterRow || group.rows[group.rows.length - 1];

          // Get all combinations of OTHER options
          const otherOptNums = [1, 2, 3].filter(n => n !== optNum);
          const otherCombos: string[][] = [];
          const seen = new Set<string>();
          for (const row of group.rows) {
            const combo = otherOptNums.map(n => row[`Option${n} Value`]?.trim() || '');
            const key = combo.join('|||');
            if (!seen.has(key)) { seen.add(key); otherCombos.push(combo); }
          }

          // Find insertion point (after the last row with afterValue)
          let insertIdx = group.rows.length; // default: end
          if (afterValue) {
            for (let i = group.rows.length - 1; i >= 0; i--) {
              if (group.rows[i][optKey]?.trim() === afterValue) { insertIdx = i + 1; break; }
            }
          }

          // Build new rows for the new value (one per combo of other options)
          const newRows: ShopifyProduct[] = (otherCombos.length > 0 ? otherCombos : [otherOptNums.map(() => '')]).map(combo => {
            const newRow: ShopifyProduct = { ...template };
            newRow.Handle = '';
            for (const field of PRODUCT_LEVEL_FIELDS) newRow[field] = '';
            newRow[optKey] = newValue;
            otherOptNums.forEach((n, i) => { newRow[`Option${n} Value`] = combo[i] || ''; });
            newRow['Variant SKU'] = '';
            newRow['Variant Barcode'] = '';
            return newRow;
          });

          // Insert at position
          const before = group.rows.slice(0, insertIdx);
          const after = group.rows.slice(insertIdx);
          newData.push(...before, ...newRows, ...after);
          editedVariantCount += newRows.length;
        }

        modifiedData = newData;

      } else if (variantAction === 'vo_add_new_option') {
        // Add an entirely new option to the product (e.g. add "Personalizar" with default value "Não")
        const newOptionName = (actionParams.optionName || '').trim();
        const defaultValue = (actionParams.text || '').trim();
        if (!newOptionName || !defaultValue) { setDataHistory((prev) => prev.slice(0, -1)); return; }

        const newData: ShopifyProduct[] = [];

        for (const group of grouped) {
          if (!matchedHandles.has(group.handle)) { newData.push(...group.rows); continue; }

          // Find the first empty option slot (1, 2, or 3)
          const firstRow = group.rows[0];
          let newOptNum = 0;
          for (let n = 1; n <= 3; n++) {
            if (!firstRow[`Option${n} Name`]?.trim()) { newOptNum = n; break; }
          }
          if (!newOptNum) {
            // All 3 options used — can't add more
            newData.push(...group.rows);
            continue;
          }

          // Set the new option name and default value on all rows
          for (const row of group.rows) {
            const newRow = { ...row };
            if (newRow.Handle || group.rows.indexOf(row) === 0) {
              newRow[`Option${newOptNum} Name`] = newOptionName;
            }
            newRow[`Option${newOptNum} Value`] = defaultValue;
            newData.push(newRow);
          }
          editedVariantCount += group.rows.length;
        }

        modifiedData = newData;
      }
    } else {
      // ─── Standard cell-level edit ────────────────────────────────
      const firstRowIndexByHandle = new Map<string, number>();
      for (let i = 0; i < data.length; i++) {
        const h = data[i].Handle;
        if (h && !firstRowIndexByHandle.has(h)) {
          firstRowIndexByHandle.set(h, i);
        }
      }

      modifiedData = data.map((row, rowIndex) => {
        let rowHandle = row.Handle;
        if (!rowHandle) {
          for (let i = rowIndex - 1; i >= 0; i--) {
            if (data[i].Handle) {
              rowHandle = data[i].Handle;
              break;
            }
          }
        }

        if (!matchedHandles.has(rowHandle)) return row;

        const newRow = { ...row };

        if (isProductLevelField(resolvedTargetField)) {
          const firstIdx = firstRowIndexByHandle.get(rowHandle);
          if (rowIndex !== firstIdx) return row;

          const currentValue = String(newRow[resolvedTargetField] || '');
          newRow[resolvedTargetField] = applyAction(currentValue, resolvedActionType, actionParams);
          editedVariantCount++;
        } else {
          if (!doesRowMatchVariantFilter(row)) return row;

          const currentValue = String(newRow[resolvedTargetField] || '');
          newRow[resolvedTargetField] = applyAction(currentValue, resolvedActionType, actionParams);
          editedVariantCount++;
        }

        return newRow;
      });
    }

    // Apply in-memory instead of downloading
    setData(modifiedData);

    // Add to task history
    const allActions = [...TEXT_ACTIONS, ...NUMBER_ACTIONS, ...VARIANT_COMPOUND_ACTIONS];
    const actionLabel = isVariantsMode
      ? VARIANT_COMPOUND_ACTIONS.find((a) => a.value === variantAction)?.label || variantAction
      : allActions.find((a) => a.value === actionType)?.label || actionType;

    const structuralDescription = isStructuralVariantAction
      ? (variantAction === 'vo_delete_option_value'
        ? `Remover opção "${actionParams.optionName}"`
        : variantAction === 'vo_delete_variant'
        ? `Remover variantes: ${(actionParams.deleteValues as string[] || []).join(', ')} de "${actionParams.optionName}"`
        : variantAction === 'vo_add_variant_value'
        ? `Adicionar variante "${actionParams.text}" em ${actionParams.optionName}${actionParams.afterValue ? ` depois de "${actionParams.afterValue}"` : ''}`
        : variantAction === 'vo_add_new_option'
        ? `Adicionar nova opção "${actionParams.optionName}" com valor padrão "${actionParams.text}"`
        : `Ação em variantes`)
      : undefined;

    const historyItem: TaskHistoryItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      timestamp: new Date(),
      fileName: fileName || 'products.csv',
      targetField: resolvedTargetField,
      targetFieldLabel: getFieldLabel(targetField),
      actionType: resolvedActionType,
      actionLabel,
      actionParams: { ...actionParams, ...(structuralDescription ? { _description: structuralDescription } : {}) },
      productCount: filteredProducts.length,
      variantCount: editedVariantCount,
      conditions: conditions.filter((c) => c.value),
      variantConditions: useVariantFilter ? variantConditions.filter((c) => c.value) : null,
      status: 'success',
    };

    setTaskHistory((prev) => [historyItem, ...prev]);
    setShowHistory(true);

    // Trigger visual flash animation
    setRecentlyEdited(true);
    setTimeout(() => setRecentlyEdited(false), 1500);

    // Reset action params to clear the real-time preview
    setActionParams({});
  };

  const handleUndo = () => {
    if (dataHistory.length === 0) return;
    const previousData = dataHistory[dataHistory.length - 1];
    setData(previousData);
    setDataHistory(dataHistory.slice(0, -1));
    setTaskHistory(taskHistory.slice(1));
  };

  const handleUndoTo = (index: number) => {
    if (dataHistory.length <= index) return;
    const isMultiple = index > 0;
    if (isMultiple && !confirm(`Tem certeza? Isso irá desfazer esta edição E TODAS AS ${index} EDIÇÕES que você fez depois dela.`)) return;
    const targetData = dataHistory[dataHistory.length - 1 - index];
    setData(targetData);
    setDataHistory(dataHistory.slice(0, dataHistory.length - 1 - index));
    setTaskHistory(taskHistory.slice(index + 1));
  };

  const handleUndoAll = () => {
    if (dataHistory.length === 0) return;
    if (!confirm('Tem certeza? Isso irá reverter TODAS as edições que você fez até agora.')) return;
    setData(dataHistory[0]);
    setDataHistory([]);
    setTaskHistory([]);
  };

  const handleDownload = () => {
    if (!data.length) return;
    const csv = Papa.unparse(data);
    // Add UTF-8 BOM for Shopify compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const finalName = fileName ? (fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`) : 'products.csv';
    link.setAttribute('download', finalName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportFromShopify = async () => {
    const result = await shopify.fetchProducts();
    console.log('Shopify import result:', result);

    if (!result.success || !result.rows?.length) {
      alert(`❌ ${result.error || 'Nenhum produto encontrado na loja.'}`);
      return;
    }

    const rows = result.rows;
    const csvHeaders = Object.keys(rows[0]);
    setHeaders(csvHeaders);
    setData(rows);
    setDataHistory([]);
    setTaskHistory([]);
    setFileName(`shopify-import-${new Date().toISOString().slice(0, 10)}.csv`);
    alert(`✅ ${result.productCount} produto(s) importados da Shopify!`);
  };

  const handlePublishToShopify = async () => {
    if (!data.length) return;

    const handleDataMap = new Map<string, HandleChange>();

    // Product-level CSV fields
    const productFieldNames = ['Title', 'Body (HTML)', 'Tags', 'Vendor', 'Type',
      'Option1 Name', 'Option2 Name', 'Option3 Name', 'Image Src', 'Image Position',
      'Image Alt Text', 'SEO Title', 'SEO Description', 'Status'];

    // Variant-level CSV fields
    const variantFieldNames = ['Option1 Value', 'Option2 Value', 'Option3 Value',
      'Variant Price', 'Variant Compare At Price', 'Variant SKU',
      'Variant Grams', 'Variant Inventory Qty', 'Variant Inventory Policy',
      'Variant Inventory Tracker', 'Variant Weight Unit',
      'Variant Barcode', 'Variant Image'];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Resolve handle
      let handle = row.Handle;
      if (!handle) {
        for (let j = i - 1; j >= 0; j--) {
          if (data[j].Handle) { handle = data[j].Handle; break; }
        }
      }
      if (!handle) continue;

      // Get or create entry
      if (!handleDataMap.has(handle)) {
        handleDataMap.set(handle, { handle, productFields: {}, variants: [] });
      }
      const entry = handleDataMap.get(handle)!;

      // Collect product-level fields from the FIRST row per handle
      if (row.Handle) {
        for (const field of productFieldNames) {
          if (row[field] !== undefined && row[field] !== '') {
            entry.productFields[field] = String(row[field]);
          }
        }
      }

      // Collect variant data from ALL rows
      const variantData: Record<string, string> = {};
      let hasVariantData = false;
      for (const field of variantFieldNames) {
        if (row[field] !== undefined && row[field] !== '') {
          variantData[field] = String(row[field]);
          hasVariantData = true;
        }
      }
      if (hasVariantData) {
        entry.variants.push(variantData);
      }
    }

    const changes = Array.from(handleDataMap.values()).filter(c =>
      c.productFields.Title || c.variants.length > 0
    );

    if (!changes.length) {
      alert('Nenhum produto detectado para enviar à Shopify.');
      return;
    }

    if (!confirm(`Enviar ${changes.length} produto(s) com ${changes.reduce((s, c) => s + c.variants.length, 0)} variante(s) para a Shopify?\n\nProdutos existentes serão atualizados, novos serão criados.`)) return;

    const result = await shopify.pushChanges(changes);
    console.log('Shopify publish result:', result);

    if (result.success && result.summary) {
      const errs = result.summary.errors?.length
        ? `\n\n⚠️ ${result.summary.errorCount} erro(s):\n${result.summary.errors.slice(0, 5).join('\n')}${result.summary.errors.length > 5 ? '\n...(ver console)' : ''}`
        : '';
      alert(`✅ Publicado!\n\n${result.summary.productsCreated || 0} criado(s)\n${result.summary.productsUpdated} atualizado(s)\n${result.summary.variantsUpdated} variante(s) atualizada(s)${errs}`);
    } else {
      alert(`❌ Erro ao publicar: ${result.error || 'Erro desconhecido'}`);
    }
  };

  // Count how many variant rows will be affected
  const affectedVariantCount = useMemo(() => {
    if (!useVariantFilter || !isVariantLevelField) return null;
    let count = 0;
    for (const product of filteredProducts) {
      for (const row of product.rows) {
        if (doesRowMatchVariantFilter(row)) count++;
      }
    }
    return count;
  }, [filteredProducts, doesRowMatchVariantFilter, useVariantFilter, isVariantLevelField]);

  // ─── Render ─────────────────────────────────────────────────────────


  const hasData = data.length > 0;
  const hasHistory = taskHistory.length > 0;

  const getPreviewNode = (originalValue: string, fieldName: string, matchesVariantFilter: boolean, prefix = '') => {
    const effectiveTarget = resolvedTargetField;
    const effectiveAction = resolvedActionType;
    if (effectiveTarget !== fieldName || !effectiveAction || !matchesVariantFilter) {
      return <>{originalValue ? `${prefix}${originalValue}` : '-'}</>;
    }
    const newValue = applyAction(originalValue || '', effectiveAction, actionParams);
    if (newValue === originalValue) {
      return <>{originalValue ? `${prefix}${originalValue}` : '-'}</>;
    }

    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span className="line-through text-destructive text-[10px]">{originalValue ? `${prefix}${originalValue}` : '-'}</span>
        <span className="text-muted-foreground font-bold text-[10px]">→</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">{newValue ? `${prefix}${newValue}` : '-'}</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header — matches project page style */}
      <div className="px-6 pt-8 pb-6 border-b border-border flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Editor em Massa</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">Edite produtos Shopify em massa a partir de um CSV exportado.</p>
          {selectedClientId && (
            <div className="flex items-center gap-2 mt-2">
              {isShopifyConnected ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {shopifyShopName || 'Shopify conectada'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  Shopify não conectada
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <div className="flex items-center gap-2 mr-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md border border-transparent focus-within:border-border focus-within:bg-card transition-colors">
                <span className="opacity-70">📁</span>
                <input
                  type="text"
                  value={fileName || ''}
                  onChange={(e) => setFileName(e.target.value)}
                  className="bg-transparent border-none outline-none focus:ring-0 text-foreground w-40 min-w-[100px] font-medium p-0"
                  placeholder="nome_do_arquivo.csv"
                />
                <span className="opacity-50 border-l border-border pl-1.5">• {groupedProducts.length} produtos</span>
              </div>
              <label className="cursor-pointer px-3 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5 shrink-0">
                <Upload className="w-3.5 h-3.5" />
                Trocar Arquivo
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
          {dataHistory.length > 0 && (
            <button
              onClick={handleUndo}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center gap-1.5"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Desfazer
            </button>
          )}
          {hasHistory && (
            <button
              onClick={handleDownload}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Finalizar e Baixar
            </button>
          )}
          {hasHistory && isShopifyConnected && (
            <button
              onClick={handlePublishToShopify}
              disabled={shopify.pushing}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-muted disabled:text-muted-foreground text-white px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5"
            >
              {shopify.pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Store className="w-3.5 h-3.5" />}
              {shopify.pushing ? 'Publicando...' : 'Publicar na Shopify'}
            </button>
          )}
          {!hasData && (
            <>
              <label className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Enviar CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
              {isShopifyConnected && (
                <button
                  onClick={handleImportFromShopify}
                  disabled={shopify.fetching}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-muted disabled:text-muted-foreground text-white px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2"
                >
                  {shopify.fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
                  {shopify.fetching ? 'Importando...' : `Importar da Shopify`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-6 p-6 h-[calc(100vh-113px)]">
        {/* ─── LEFT: Task History ────────────────────────────── */}
        {hasData && (
          <aside className={cn("shrink-0 border border-border rounded-xl shadow-sm bg-card overflow-hidden transition-all duration-300 flex flex-col", isHistoryOpen ? "w-[320px]" : "w-[44px]")}>
            {/* Header */}
            {isHistoryOpen ? (
              <div className="p-3 border-b border-border flex items-center justify-between shrink-0 bg-card z-10">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-foreground" />
                  Histórico
                  {hasHistory && (
                    <span className="ml-auto bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">
                      {taskHistory.length}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-1 hover:bg-muted rounded-md text-muted-foreground transition-colors ml-2"
                  title="Recolher Histórico"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-3 py-4 px-1 cursor-pointer hover:bg-muted/50 transition-colors flex-1"
                onClick={() => setIsHistoryOpen(true)}
                title="Expandir Histórico"
              >
                <div className="relative">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {hasHistory && (
                    <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold">
                      {taskHistory.length}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest select-none" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
                  Histórico
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 mt-auto" />
              </div>
            )}

            {/* Content (only visible when open) */}
            <div className={cn("flex-1 overflow-y-auto", !isHistoryOpen && "hidden")}>
              {!hasHistory ? (
                <div className="p-6 text-center">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-xs text-muted-foreground">Nenhuma edição ainda</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {taskHistory.map((task, index) => (
                    <div key={task.id} className="p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm">
                          {taskHistory.length - index}
                        </span>
                        <div className="text-xs font-bold text-foreground">
                          {task.targetFieldLabel}
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground font-medium">{formatTime(task.timestamp)}</span>
                          <button
                            onClick={() => handleUndoTo(index)}
                            title={index === 0 ? "Desfazer esta ação" : "Desfazer até esta ação"}
                            className="p-1 hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors rounded"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="ml-7 space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md font-bold">
                            {getActionDescription(task.actionType, task.actionParams, task.targetField.toLowerCase().includes('price'))}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            {task.productCount} produto{task.productCount !== 1 ? 's' : ''}
                            {task.variantCount !== null && ` • ${task.variantCount} var.`}
                          </span>
                        </div>

                        {task.conditions.length > 0 && (
                          <div className="pt-1.5 space-y-1">
                            {task.conditions.map((c, ci) => (
                              <div key={ci} className="text-[10px] bg-muted/60 text-muted-foreground pl-2 py-0.5 rounded-md border-l-2 border-border flex items-center gap-1 w-max">
                                {FILTERABLE_FIELDS.find((f) => f.value === c.field)?.label || c.field}{' '}
                                <span className="opacity-70 mx-0.5">{OPERATORS.find((o) => o.value === c.operator)?.label}</span>{' '}
                                <span className="font-bold text-foreground/80">"{c.value}"</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasHistory && (
                <div className="p-3 border-t border-border">
                  <button
                    onClick={handleUndoAll}
                    className="w-full text-[10px] text-destructive hover:text-destructive/80 font-bold py-1.5 rounded border border-destructive/20 hover:bg-destructive/5 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Undo2 className="w-3 h-3" /> Reverter Todas as Alterações
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ─── CENTER: Editor ────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto space-y-5 min-w-0 pr-2 pb-6">
          {!hasData ? (
            <div className="max-w-lg mx-auto mt-20 bg-card rounded-xl shadow-none border border-border p-12 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#5c6ac4]/10 to-[#9c6ade]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-foreground" />
              </div>
              <h2 className="text-lg font-bold mb-2">Envie seu CSV da Shopify</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Exporte seus produtos, envie aqui, defina edições em massa e baixe o CSV atualizado.
              </p>
              <label className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-xl font-medium transition-all inline-flex items-center gap-2 shadow-none">
                <Upload className="w-5 h-5" />
                Selecionar CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          ) : (
            <div className="space-y-5 w-full">
              {/* Target Field */}
              <div className="bg-card rounded-xl shadow-none border border-border p-6">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Campo a Editar
                </label>
                <div className="relative">
                  <select
                    value={targetField}
                    onChange={(e) => setTargetField(e.target.value)}
                    className="w-full appearance-none bg-card border border-border rounded-md py-2 pl-4 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <optgroup label="Produto">
                      {PRODUCT_EDITABLE_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Preço">
                      {PRICE_EDITABLE_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Inventário">
                      {INVENTORY_EDITABLE_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Variantes e Opções">
                      <option value="variants_options">Variantes e Opções</option>
                    </optgroup>
                    <optgroup label="SEO">
                      {SEO_EDITABLE_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                      ))}
                    </optgroup>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Step 1: Filter */}
              <div className="bg-card rounded-xl shadow-none border border-border p-6">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Passo 1 — Filtrar Produtos
                </h2>
                <div className="space-y-2 mb-3">
                  {conditions.map((condition) => (
                    <div key={condition.id} className="flex items-center gap-2">
                      <select value={condition.field} onChange={(e) => updateCondition(condition.id, 'field', e.target.value)} className="flex-1 appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary capitalize">
                        {FILTERABLE_FIELDS.map((f) => (<option key={f.value} value={f.value}>{f.label}</option>))}
                      </select>
                      <select value={condition.operator} onChange={(e) => updateCondition(condition.id, 'operator', e.target.value)} className="w-36 appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary capitalize">
                        {OPERATORS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                      <input type="text" value={condition.value} onChange={(e) => updateCondition(condition.id, 'value', e.target.value)} placeholder="Valor..." className="flex-1 bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary" />
                      {conditions.length > 1 && (
                        <button onClick={() => removeCondition(condition.id)} className="p-1.5 text-muted-foreground/70 hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addCondition} className="text-xs text-foreground hover:text-primary font-medium flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar condição
                </button>
              </div>

              {/* Step 2: Preview */}
              <div className="bg-card rounded-xl shadow-none border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passo 2 — Preview</h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setFocusedView(!focusedView)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-bold border transition-all',
                        focusedView
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:border-primary/50'
                      )}
                      title={focusedView ? 'Mudar para visão geral' : 'Mudar para visão focada'}
                    >
                      {focusedView ? 'Visão Focada' : 'Visão Geral'}
                    </button>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(0); }} className="appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-xs focus:outline-none focus:border-primary">
                      <option value={5}>5 por página</option>
                      <option value={10}>10 por página</option>
                      <option value={20}>20 por página</option>
                      <option value={50}>50 por página</option>
                    </select>
                    <span className="text-xs text-foreground bg-muted px-3 py-1 rounded-full font-bold whitespace-nowrap">
                      {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div
                  className="overflow-x-auto border border-border rounded-md cursor-grab active:cursor-grabbing select-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const el = e.currentTarget;
                    const startX = e.pageX;
                    const scrollLeft = el.scrollLeft;
                    let moved = false;
                    const onMove = (ev: MouseEvent) => { ev.preventDefault(); moved = true; el.scrollLeft = scrollLeft - (ev.pageX - startX); };
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); if (moved) { el.dataset.dragged = '1'; setTimeout(() => delete el.dataset.dragged, 0); } };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  }}
                >
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-foreground border-b border-border">
                      <tr className="divide-x divide-border/50">
                        {visibleColumns.includes('expand') && (
                          <th className="py-2.5 px-3 font-bold whitespace-nowrap" style={{ width: '40px' }}></th>
                        )}
                        {visibleColumns.includes('title') && (
                          <th className="py-2.5 px-4 font-bold whitespace-nowrap">Título</th>
                        )}
                        {visibleColumns.includes('variants') && (
                          <th className="py-2.5 px-4 font-bold whitespace-nowrap">Variantes</th>
                        )}
                        {visibleColumns.includes('price') && (
                          <th className="py-2.5 px-4 font-bold whitespace-nowrap">Preço</th>
                        )}
                        {visibleColumns.includes('status') && (
                          <th className="py-2.5 px-4 font-bold whitespace-nowrap">Status</th>
                        )}
                        {visibleColumns.includes('vendor') && (
                          <th className="py-2.5 px-4 font-bold whitespace-nowrap">Vendedor</th>
                        )}
                        {visibleColumns.includes('tags') && (
                          <th className="py-2.5 px-4 font-bold whitespace-nowrap">Tags</th>
                        )}
                        {visibleColumns.includes('description') && (
                          <th className="py-2.5 px-4 font-bold whitespace-nowrap">Descrição</th>
                        )}
                        {visibleColumns.includes('inventory') && (
                          <th className="py-2.5 px-4 font-bold whitespace-nowrap">Estoque</th>
                        )}
                        {visibleColumns.includes('variants') && (
                          <th className="py-2.5 px-4 font-bold whitespace-nowrap">Variantes</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {paginatedProducts.map((product) => (
                        <React.Fragment key={product.handle}>
                          <tr
                            className={cn(
                              "hover:bg-muted/50 cursor-pointer transition-colors duration-500 divide-x divide-border/30",
                              recentlyEdited ? "bg-primary/20" : ""
                            )}
                            onClick={(e) => { if (!(e.currentTarget.closest('[data-dragged]'))) toggleExpand(product.handle); }}
                          >
                            {visibleColumns.includes('expand') && (
                              <td className="py-2.5 px-3 text-foreground/50">
                                {expandedProducts.has(product.handle) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </td>
                            )}
                            {visibleColumns.includes('title') && (
                              <td className="py-2.5 px-4 font-bold text-foreground whitespace-nowrap">{getPreviewNode(product.title, 'Title', true)}</td>
                            )}
                            {visibleColumns.includes('variants') && (
                              <td className="py-2.5 px-4 font-medium text-foreground whitespace-nowrap">{product.rows.length}</td>
                            )}
                            {visibleColumns.includes('price') && (
                              <td className="py-2.5 px-4 font-medium text-foreground whitespace-nowrap">{getPriceRange(product.rows)}</td>
                            )}
                            {visibleColumns.includes('status') && (
                              <td className="py-2.5 px-4 font-medium text-foreground whitespace-nowrap">{product.rows[0]?.['Status'] || '-'}</td>
                            )}
                            {visibleColumns.includes('vendor') && (
                              <td className="py-2.5 px-4 font-medium text-foreground whitespace-nowrap">{getPreviewNode(product.vendor || '', 'Vendor', true)}</td>
                            )}
                            {visibleColumns.includes('tags') && (
                              <td className="py-2.5 px-4 font-medium text-foreground whitespace-nowrap max-w-[300px] truncate">{getPreviewNode(product.tags || '', 'Tags', true)}</td>
                            )}
                            {visibleColumns.includes('description') && (
                              <td className="py-2.5 px-4 font-medium text-foreground whitespace-nowrap max-w-[400px] truncate">{getPreviewNode(product.rows[0]?.['Body (HTML)'] || '', 'Body (HTML)', true)}</td>
                            )}
                            {visibleColumns.includes('inventory') && (
                              <td className="py-2.5 px-4 font-medium text-foreground whitespace-nowrap">
                                {(() => {
                                  const totalQty = product.rows.reduce((sum, row) => sum + (parseInt(row['Variant Inventory Qty'] || '0') || 0), 0);
                                  return totalQty > 0 ? totalQty : '0';
                                })()}
                              </td>
                            )}
                            {visibleColumns.includes('variants') && (
                              <td className="py-2.5 px-4 font-medium text-foreground whitespace-nowrap">{product.rows.length}</td>
                            )}
                          </tr>
                          {expandedProducts.has(product.handle) && (
                            <tr>
                              <td colSpan={visibleColumns.length} className="p-0">
                                <div
                                  className="bg-muted/30 border-t border-border shadow-inner overflow-x-auto cursor-grab active:cursor-grabbing select-none"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const el = e.currentTarget;
                                    const startX = e.pageX;
                                    const scrollLeft = el.scrollLeft;
                                    const onMove = (ev: MouseEvent) => { ev.preventDefault(); el.scrollLeft = scrollLeft - (ev.pageX - startX); };
                                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                                    document.addEventListener('mousemove', onMove);
                                    document.addEventListener('mouseup', onUp);
                                  }}
                                >
                                  {(() => {
                                    // Build dynamic columns: options first, then variant fields, then product fields
                                    let allCols: { key: string; label: React.ReactNode; getValue: (row: Record<string, string>, ri: number) => string }[] = [];
                                    // Option columns (always show)
                                    for (let n = 1; n <= 3; n++) {
                                      const nameKey = `Option${n} Name`;
                                      const valKey = `Option${n} Value`;
                                      if (product.rows[0]?.[nameKey]) {
                                        allCols.push({ key: nameKey, label: getPreviewNode(product.rows[0][nameKey], nameKey, true), getValue: (row) => row[valKey] || '' });
                                      }
                                    }

                                    // Determine which variant columns to show based on focusedView
                                    const visibleVariantKeys = new Set<string>();

                                    if (!focusedView) {
                                      // Visão geral - mostrar todas as colunas de variante
                                      for (const [csvKey] of VARIANT_COLUMN_LABELS) {
                                        visibleVariantKeys.add(csvKey);
                                      }
                                    } else {
                                      // Visão focada - mostrar apenas colunas relevantes baseado no campo
                                      if (isPriceField) {
                                        visibleVariantKeys.add('Variant Price');
                                        visibleVariantKeys.add('Variant Compare At Price');
                                      } else if (isInventoryQtyField || resolvedTargetField === 'Variant Inventory Qty') {
                                        visibleVariantKeys.add('Variant Inventory Qty');
                                      } else if (resolvedTargetField === 'Variant Inventory Policy') {
                                        visibleVariantKeys.add('Variant Inventory Policy');
                                      } else if (resolvedTargetField === 'Variant SKU') {
                                        visibleVariantKeys.add('Variant SKU');
                                      } else if (resolvedTargetField === 'Variant Grams' || resolvedTargetField === 'Variant Weight Unit') {
                                        visibleVariantKeys.add('Variant Grams');
                                        visibleVariantKeys.add('Variant Weight Unit');
                                      } else if (resolvedTargetField === 'Variant Barcode') {
                                        visibleVariantKeys.add('Variant Barcode');
                                      } else if (isVariantsMode) {
                                        // Se editando variantes, mostrar tudo
                                        for (const [csvKey] of VARIANT_COLUMN_LABELS) {
                                          visibleVariantKeys.add(csvKey);
                                        }
                                      } else {
                                        // Default: mostrar preço e estoque
                                        visibleVariantKeys.add('Variant Price');
                                        visibleVariantKeys.add('Variant Inventory Qty');
                                        visibleVariantKeys.add('Variant SKU');
                                      }
                                    }

                                    // Variant data columns (only those with data and visible)
                                    for (const [csvKey, label] of VARIANT_COLUMN_LABELS) {
                                      if (visibleVariantKeys.has(csvKey) && product.rows.some(r => r[csvKey] && String(r[csvKey]).trim() !== '')) {
                                        allCols.push({ key: csvKey, label, getValue: (row) => row[csvKey] || '' });
                                      }
                                    }
                                    // Product-level columns (same value for all rows, from row 0)
                                    for (const [csvKey, label] of PRODUCT_COLUMN_LABELS) {
                                      if (product.rows[0]?.[csvKey] && String(product.rows[0][csvKey]).trim() !== '') {
                                        allCols.push({ key: `prod_${csvKey}`, label, getValue: (_row, ri) => ri === 0 ? (product.rows[0][csvKey] || '') : '' });
                                      }
                                    }
                                    return (
                                      <table className="w-full text-sm">
                                        <thead className="text-foreground bg-muted/40 border-b border-border/50">
                                          <tr className="divide-x divide-border/50">
                                            {allCols.map(col => (
                                              <th key={col.key} className="py-2.5 px-4 font-bold text-left whitespace-nowrap">{col.label}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/20">
                                          {product.rows.map((row, ri) => {
                                            const matchesVariant = doesRowMatchVariantFilter(row);
                                            return (
                                              <tr
                                                key={ri}
                                                className={cn(
                                                  'transition-all duration-500 divide-x divide-border/20',
                                                  recentlyEdited && matchesVariant && 'bg-primary/30',
                                                  (useVariantFilter && !matchesVariant) && 'opacity-40 grayscale'
                                                )}
                                              >
                                                {allCols.map(col => {
                                                  const val = col.getValue(row, ri);
                                                  const fieldName = col.key.startsWith('prod_') ? col.key.slice(5) : col.key;
                                                  return (
                                                    <td key={col.key} className="py-2 px-4 font-medium text-foreground whitespace-nowrap">{val ? getPreviewNode(val, fieldName, matchesVariant) : <span className="text-muted-foreground/40">-</span>}</td>
                                                  );
                                                })}
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {filteredProducts.length === 0 && (
                        <tr><td colSpan={visibleColumns.length} className="py-6 text-center text-xs text-muted-foreground/70">Nenhum produto encontrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground/70">{currentPage * itemsPerPage + 1}-{Math.min((currentPage + 1) * itemsPerPage, filteredProducts.length)} de {filteredProducts.length}</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1 rounded border border-border disabled:opacity-40 hover:bg-muted"><ChevronLeft className="w-3 h-3" /></button>
                      <span className="text-[10px] text-muted-foreground">{currentPage + 1}/{totalPages}</span>
                      <button onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} className="p-1 rounded border border-border disabled:opacity-40 hover:bg-muted"><ChevronRight className="w-3 h-3" /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Step: Variant Filter */}
              {isVariantLevelField && (
                <div className="bg-card rounded-xl shadow-none border border-border p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-foreground" /> Opcional — Filtrar Variantes
                    </h2>
                    <div className={cn('relative w-9 h-5 rounded-full transition-colors cursor-pointer', useVariantFilter ? 'bg-primary' : 'bg-[#c4cdd5]')} onClick={() => setUseVariantFilter(!useVariantFilter)}>
                      <div className={cn('absolute top-0.5 w-4 h-4 bg-card rounded-full shadow transition-transform', useVariantFilter ? 'translate-x-4' : 'translate-x-0.5')} />
                    </div>
                  </div>
                  {useVariantFilter ? (
                    <>
                      <div className="space-y-2 mb-3">
                        {variantConditions.map((condition) => (
                          <div key={condition.id} className="flex items-center gap-2">
                            <select value={condition.field} onChange={(e) => updateVariantCondition(condition.id, 'field', e.target.value)} className="flex-1 appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary">
                              {dynamicVariantFields.map((f) => (<option key={f.value} value={f.value}>{f.label}</option>))}
                            </select>
                            <select value={condition.operator} onChange={(e) => updateVariantCondition(condition.id, 'operator', e.target.value)} className="w-36 appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary">
                              {OPERATORS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                            </select>
                            <input type="text" value={condition.value} onChange={(e) => updateVariantCondition(condition.id, 'value', e.target.value)} placeholder="Valor..." className="flex-1 bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary" />
                            {variantConditions.length > 1 && (
                              <button onClick={() => removeVariantCondition(condition.id)} className="p-1.5 text-muted-foreground/70 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <button onClick={addVariantCondition} className="text-xs text-foreground hover:text-primary font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar</button>
                        {affectedVariantCount !== null && (
                          <span className="text-xs text-foreground bg-muted px-2.5 py-0.5 rounded-full font-bold">{affectedVariantCount} variante{affectedVariantCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/70 italic">Todas as variantes serão editadas.</p>
                  )}
                </div>
              )}

              {/* Step 3: Action */}
              <div className="bg-card rounded-xl shadow-none border border-border p-6">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                  {isVariantsMode ? 'Passo 2 — Ação de Variantes e Opções' : isSEOMode ? 'Passo 3 — Configurar SEO' : 'Passo 3 — Ação'}
                </h2>
                <div className="space-y-3">
                  {isSEOMode ? (
                    <>
                      {targetField === 'seo_meta_title' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                              Template Meta Title
                            </label>
                            <div className="space-y-2 mb-3">
                              {SEO_TITLE_TEMPLATES.map((tmpl) => (
                                <button
                                  key={tmpl.value}
                                  onClick={() => setActionParams({ text: tmpl.value })}
                                  className={cn(
                                    'w-full py-2 px-3 rounded-md text-xs text-left border transition-all',
                                    actionParams.text === tmpl.value
                                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                                      : 'bg-card text-foreground border-border hover:border-primary/50'
                                  )}
                                >
                                  {tmpl.label}
                                </button>
                              ))}
                            </div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                              Ou customizar
                            </label>
                            <textarea
                              placeholder="[product_title] | [shop_name]"
                              value={actionParams.text || ''}
                              onChange={(e) => setActionParams({ text: e.target.value })}
                              className="w-full bg-card border border-border rounded-md py-2 px-3 text-sm focus:outline-none focus:border-primary resize-y"
                              rows={3}
                            />
                          </div>
                          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs text-blue-700 dark:text-blue-400">
                            <strong>Variáveis disponíveis:</strong> [product_title], [product_type], [product_category], [product_vendor], [shop_name], [price], [compared_price]
                            <div className="mt-2 text-[11px] opacity-90">
                              • Meta title ideal: 50-60 caracteres<br/>
                              • Use variáveis para personalizar automaticamente
                            </div>
                          </div>
                        </div>
                      )}
                      {targetField === 'seo_meta_description' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                              Template Meta Description
                            </label>
                            <div className="space-y-2 mb-3">
                              {SEO_DESCRIPTION_TEMPLATES.map((tmpl) => (
                                <button
                                  key={tmpl.value}
                                  onClick={() => setActionParams({ text: tmpl.value })}
                                  className={cn(
                                    'w-full py-2 px-3 rounded-md text-xs text-left border transition-all',
                                    actionParams.text === tmpl.value
                                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                                      : 'bg-card text-foreground border-border hover:border-primary/50'
                                  )}
                                >
                                  {tmpl.label}
                                </button>
                              ))}
                            </div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                              Ou customizar
                            </label>
                            <textarea
                              placeholder="Descreva seu produto..."
                              value={actionParams.text || ''}
                              onChange={(e) => setActionParams({ text: e.target.value })}
                              className="w-full bg-card border border-border rounded-md py-2 px-3 text-sm focus:outline-none focus:border-primary resize-y"
                              rows={4}
                            />
                          </div>
                          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs text-blue-700 dark:text-blue-400">
                            <strong>Variáveis disponíveis:</strong> [product_title], [product_type], [product_category], [product_vendor], [shop_name], [price], [compared_price]
                            <div className="mt-2 text-[11px] opacity-90">
                              • Meta description ideal: 150-160 caracteres<br/>
                              • Inclua call-to-action quando possível
                            </div>
                          </div>
                        </div>
                      )}
                      {targetField === 'seo_handle' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                              Template URL Handle
                            </label>
                            <div className="space-y-2 mb-3">
                              {SEO_HANDLE_TEMPLATES.map((tmpl) => (
                                <button
                                  key={tmpl.value}
                                  onClick={() => setActionParams({ text: tmpl.value })}
                                  className={cn(
                                    'w-full py-2 px-3 rounded-md text-xs text-left border transition-all',
                                    actionParams.text === tmpl.value
                                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                                      : 'bg-card text-foreground border-border hover:border-primary/50'
                                  )}
                                >
                                  {tmpl.label}
                                </button>
                              ))}
                            </div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                              Ou customizar
                            </label>
                            <input
                              type="text"
                              placeholder="[product_title]"
                              value={actionParams.text || ''}
                              onChange={(e) => setActionParams({ text: e.target.value })}
                              className="w-full bg-card border border-border rounded-md py-2 px-3 text-sm focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs text-blue-700 dark:text-blue-400">
                            <strong>Variáveis disponíveis:</strong> [product_title], [product_type], [barcode], [shop_name]
                            <div className="mt-2 text-[11px] opacity-90">
                              • Use hífens para separar palavras (não espaços)<br/>
                              • URLs com 50-75 caracteres são ideais<br/>
                              • Apenas números, letras e hífens serão mantidos
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : isVariantsMode ? (
                    <>
                      {/* Variant compound action selector */}
                      <div className="relative w-full">
                        <select
                          value={variantAction}
                          onChange={(e) => { setVariantAction(e.target.value as VariantEditAction); setActionParams({}); }}
                          className="w-full appearance-none bg-card border border-border rounded-md py-1.5 pl-3 pr-10 text-sm focus:outline-none focus:border-primary"
                        >
                          <optgroup label="Valor da Variante">
                            {VARIANT_COMPOUND_ACTIONS.filter(a => a.value.includes('_value') && !a.value.startsWith('vo_delete') && !a.value.startsWith('vo_add')).map((a) => (
                              <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Nome da Opção">
                            {VARIANT_COMPOUND_ACTIONS.filter(a => a.value.includes('_name')).map((a) => (
                              <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Gerenciar Opções">
                            {VARIANT_COMPOUND_ACTIONS.filter(a => a.value === 'vo_delete_option_value' || a.value === 'vo_add_option_value' || a.value === 'vo_delete_variant').map((a) => (
                              <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                          </optgroup>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground"><ChevronDown className="w-4 h-4" /></div>
                      </div>

                      {/* Option selector: dropdown */}
                      {!isStructuralVariantAction && realOptionNames.length > 0 && (
                        <div className="relative">
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Qual opção?
                          </label>
                          <select
                            value={selectedOptionName}
                            onChange={(e) => setSelectedOptionName(e.target.value)}
                            className="w-full appearance-none bg-card border border-border rounded-md py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-primary"
                          >
                            <option value="">Selecione uma opção...</option>
                            {realOptionNames.map((optName) => (
                              <option key={optName} value={optName}>{optName}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground"><ChevronDown className="w-4 h-4" /></div>
                        </div>
                      )}

                      {/* Variant action inputs */}
                      <div className="w-full space-y-2">
                        {isStructuralVariantAction ? (
                          <>
                            {variantAction === 'vo_delete_option_value' && (
                              <>
                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                  Qual opção remover?
                                </label>
                                <select
                                  value={actionParams.optionName || ''}
                                  onChange={(e) => setActionParams({ optionName: e.target.value })}
                                  className="w-full appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary"
                                >
                                  <option value="">Selecione uma opção...</option>
                                  {distinctOptionNames.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                  ))}
                                </select>
                                {actionParams.optionName && (
                                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive font-medium">
                                    A opção "{actionParams.optionName}" será removida dos produtos filtrados, junto com todas as variantes duplicadas resultantes.
                                  </div>
                                )}
                              </>
                            )}
                            {variantAction === 'vo_add_variant_value' && (
                              <>
                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                  Qual opção?
                                </label>
                                <select
                                  value={actionParams.optionName || ''}
                                  onChange={(e) => setActionParams({ optionName: e.target.value, text: '', afterValue: '' })}
                                  className="w-full appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary"
                                >
                                  <option value="">Selecione uma opção...</option>
                                  {distinctOptionNames.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                  ))}
                                </select>
                                {actionParams.optionName && (
                                  <>
                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 mt-2">
                                      Novo valor
                                    </label>
                                    <input
                                      type="text"
                                      placeholder={`Ex: 2GG, 3GG...`}
                                      value={actionParams.text || ''}
                                      onChange={(e) => setActionParams({ ...actionParams, text: e.target.value })}
                                      className="w-full bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary"
                                    />
                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 mt-2">
                                      Posicionar depois de
                                    </label>
                                    <select
                                      value={actionParams.afterValue || ''}
                                      onChange={(e) => setActionParams({ ...actionParams, afterValue: e.target.value })}
                                      className="w-full appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary"
                                    >
                                      <option value="">No final (última posição)</option>
                                      {getRealOptionValues(actionParams.optionName).map((val) => (
                                        <option key={val} value={val}>Depois de {val}</option>
                                      ))}
                                    </select>
                                    {actionParams.text && (
                                      <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-2">
                                        Variante "{actionParams.text}" será adicionada {actionParams.afterValue ? `depois de "${actionParams.afterValue}"` : 'no final'} em {actionParams.optionName}. Preço e dados herdados de "{actionParams.afterValue || 'última variante'}".
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                            {variantAction === 'vo_add_new_option' && (
                              <>
                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                  Nome da nova opção
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ex: Personalizar, Cor, Material..."
                                  value={actionParams.optionName || ''}
                                  onChange={(e) => setActionParams({ ...actionParams, optionName: e.target.value })}
                                  className="w-full bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary"
                                />
                                {actionParams.optionName && (
                                  <>
                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 mt-2">
                                      Valor padrão
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Ex: Não, Padrão, Sim..."
                                      value={actionParams.text || ''}
                                      onChange={(e) => setActionParams({ ...actionParams, text: e.target.value })}
                                      className="w-full bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary"
                                    />
                                    {actionParams.text && (
                                      <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs text-blue-700 dark:text-blue-400 font-medium mt-2">
                                        Nova opção "{actionParams.optionName}" será adicionada com valor padrão "{actionParams.text}" em todas as variantes dos produtos filtrados.
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                            {variantAction === 'vo_delete_variant' && (
                              <>
                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                  Qual opção?
                                </label>
                                <select
                                  value={actionParams.optionName || ''}
                                  onChange={(e) => setActionParams({ optionName: e.target.value, deleteValues: [] })}
                                  className="w-full appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary"
                                >
                                  <option value="">Selecione uma opção...</option>
                                  {distinctOptionNames.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                  ))}
                                </select>
                                {actionParams.optionName && distinctOptionValues.length > 0 && (
                                  <>
                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 mt-3">
                                      Quais valores remover?
                                    </label>
                                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto p-2 bg-muted/20 rounded-md border border-border/30">
                                      {distinctOptionValues.map((val) => {
                                        const selected = (actionParams.deleteValues as string[] || []).includes(val);
                                        return (
                                          <label key={val} className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-sm",
                                            selected ? "bg-destructive/10 text-destructive font-medium" : "hover:bg-muted/40"
                                          )}>
                                            <input
                                              type="checkbox"
                                              checked={selected}
                                              onChange={(e) => {
                                                const current = (actionParams.deleteValues as string[] || []);
                                                const newValues = e.target.checked
                                                  ? [...current, val]
                                                  : current.filter((v: string) => v !== val);
                                                setActionParams({ ...actionParams, deleteValues: newValues });
                                              }}
                                              className="rounded border-border"
                                            />
                                            {val}
                                          </label>
                                        );
                                      })}
                                    </div>
                                    {(actionParams.deleteValues as string[] || []).length > 0 && (
                                      <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive font-medium">
                                        {(actionParams.deleteValues as string[]).length} valor(es) selecionado(s): as variantes com esses valores em "{actionParams.optionName}" serão removidas dos produtos filtrados.
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            {resolvedActionType === 'find_replace' && selectedOptionName && (
                              <>
                                <div>
                                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                                    Localizar
                                  </label>
                                  <div className="relative">
                                    <select value={actionParams.find || ''} onChange={(e) => setActionParams({ ...actionParams, find: e.target.value })} className="w-full appearance-none bg-card border border-border rounded-md py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-primary">
                                      <option value="">Selecione um valor...</option>
                                      {getRealOptionValues(selectedOptionName).map((val) => (
                                        <option key={val} value={val}>{val}</option>
                                      ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground"><ChevronDown className="w-4 h-4" /></div>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 mt-3">
                                    Substituir por
                                  </label>
                                  <input type="text" placeholder="Novo valor..." value={actionParams.replace || ''} onChange={(e) => setActionParams({ ...actionParams, replace: e.target.value })} className="w-full bg-card border border-border rounded-md py-2 px-4 text-sm focus:outline-none focus:border-primary" />
                                </div>
                              </>
                            )}
                            {resolvedActionType === 'remove_text' && selectedOptionName && (
                              <div>
                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                                  Remover valor
                                </label>
                                <div className="relative">
                                  <select value={actionParams.text || ''} onChange={(e) => setActionParams({ ...actionParams, text: e.target.value })} className="w-full appearance-none bg-card border border-border rounded-md py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-primary">
                                    <option value="">Selecione um valor...</option>
                                    {getRealOptionValues(selectedOptionName).map((val) => (
                                      <option key={val} value={val}>{val}</option>
                                    ))}
                                  </select>
                                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground"><ChevronDown className="w-4 h-4" /></div>
                                </div>
                              </div>
                            )}
                            {resolvedActionType === 'change_case' && selectedOptionName && (
                              <div>
                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                                  Converter para
                                </label>
                                <select value={actionParams.case || 'uppercase'} onChange={(e) => setActionParams({ ...actionParams, case: e.target.value })} className="w-full appearance-none bg-card border border-border rounded-md py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-primary">
                                  <option value="uppercase">MAIÚSCULAS</option>
                                  <option value="lowercase">minúsculas</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground"><ChevronDown className="w-4 h-4" /></div>
                              </div>
                            )}
                            {resolvedActionType === 'set_to' && selectedOptionName && (
                              <div>
                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                                  Novo valor
                                </label>
                                <input type="text" placeholder="Digite o novo valor..." value={actionParams.text || ''} onChange={(e) => setActionParams({ ...actionParams, text: e.target.value })} className="w-full bg-card border border-border rounded-md py-2 px-4 text-sm focus:outline-none focus:border-primary" />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative w-full">
                        <select value={actionType} onChange={(e) => { setActionType(e.target.value as EditActionType); setActionParams({}); }} className="w-full appearance-none bg-card border border-border rounded-md py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-primary capitalize">
                          {availableActions.map((a) => (<option key={a.value} value={a.value}>{a.label}</option>))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground"><ChevronDown className="w-4 h-4" /></div>
                      </div>

                      <div className="w-full space-y-2">
                        {(actionType === 'add_beginning' || actionType === 'add_end' || actionType === 'remove_text' || actionType === 'set_to') && !isPriceField && !isInventoryQtyField && !isInventorySelectField && (
                          targetField === 'Body (HTML)' ? (
                            <textarea rows={4} placeholder="Texto HTML..." value={actionParams.text || ''} onChange={(e) => setActionParams({ ...actionParams, text: e.target.value })} className="w-full bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary resize-y" />
                          ) : (
                            <input type="text" placeholder={targetField === 'Tags' ? "Tags separadas por vírgula..." : targetField === 'Vendor' ? "Nome do vendedor..." : "Texto..."} value={actionParams.text || ''} onChange={(e) => setActionParams({ ...actionParams, text: e.target.value })} className="w-full bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary" />
                          )
                        )}
                        {actionType === 'find_replace' && (
                          <>
                            <input type="text" placeholder="Localizar..." value={actionParams.find || ''} onChange={(e) => setActionParams({ ...actionParams, find: e.target.value })} className="w-full bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary" />
                            <input type="text" placeholder="Substituir por..." value={actionParams.replace || ''} onChange={(e) => setActionParams({ ...actionParams, replace: e.target.value })} className="w-full bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary" />
                          </>
                        )}
                        {actionType === 'change_case' && (
                          <select value={actionParams.case || 'uppercase'} onChange={(e) => setActionParams({ ...actionParams, case: e.target.value })} className="w-full bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary">
                            <option value="uppercase">MAIÚSCULAS</option>
                            <option value="lowercase">minúsculas</option>
                          </select>
                        )}
                        {(actionType === 'increase_by_amount' || actionType === 'decrease_by_amount') && (
                          <div className="flex border border-border rounded-md bg-card focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all overflow-hidden items-stretch">
                            {!isInventoryQtyField && <span className="flex items-center px-4 bg-muted/50 text-muted-foreground text-sm font-bold border-r border-border">R$</span>}
                            <input type="number" placeholder={isInventoryQtyField ? '0' : '0.00'} value={actionParams.amount || ''} onChange={(e) => setActionParams({ ...actionParams, amount: e.target.value })} className="w-full py-2 px-3 text-sm focus:outline-none bg-transparent" />
                            {isInventoryQtyField && <span className="flex items-center px-4 bg-muted/50 text-muted-foreground text-sm font-bold border-l border-border">un.</span>}
                          </div>
                        )}
                        {(actionType === 'increase_by_percent' || actionType === 'decrease_by_percent') && (
                          <div className="flex border border-border rounded-md bg-card focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all overflow-hidden items-stretch">
                            <input type="number" placeholder="0" value={actionParams.percent || ''} onChange={(e) => setActionParams({ ...actionParams, percent: e.target.value })} className="w-full py-2 px-3 text-sm focus:outline-none bg-transparent" />
                            <span className="flex items-center px-4 bg-muted/50 text-muted-foreground text-sm font-bold border-l border-border">%</span>
                          </div>
                        )}
                        {actionType === 'set_to' && isPriceField && (
                          <div className="flex border border-border rounded-md bg-card focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all overflow-hidden items-stretch">
                            <span className="flex items-center px-4 bg-muted/50 text-muted-foreground text-sm font-bold border-r border-border">R$</span>
                            <input type="number" placeholder="0.00" value={actionParams.text || ''} onChange={(e) => setActionParams({ ...actionParams, text: e.target.value })} className="w-full py-2 px-3 text-sm focus:outline-none bg-transparent" />
                          </div>
                        )}
                        {actionType === 'set_to' && isInventoryQtyField && (
                          <div className="flex border border-border rounded-md bg-card focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all overflow-hidden items-stretch">
                            <input type="number" placeholder="0" value={actionParams.text || ''} onChange={(e) => setActionParams({ ...actionParams, text: e.target.value })} className="w-full py-2 px-3 text-sm focus:outline-none bg-transparent" />
                            <span className="flex items-center px-4 bg-muted/50 text-muted-foreground text-sm font-bold border-l border-border">un.</span>
                          </div>
                        )}
                        {isInventorySelectField && targetField === 'Variant Inventory Policy' && (
                          <select value={actionParams.text || 'deny'} onChange={(e) => setActionParams({ ...actionParams, text: e.target.value })} className="w-full appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary">
                            <option value="deny">Não vender sem estoque (deny)</option>
                            <option value="continue">Continuar vendendo sem estoque (continue)</option>
                          </select>
                        )}
                        {isInventorySelectField && targetField === 'Variant Inventory Tracker' && (
                          <select value={actionParams.text ?? 'shopify'} onChange={(e) => setActionParams({ ...actionParams, text: e.target.value })} className="w-full appearance-none bg-card border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary">
                            <option value="shopify">Acompanhar estoque (shopify)</option>
                            <option value="">Não acompanhar estoque</option>
                          </select>
                        )}
                      </div>
                    </>
                  )}

                  <button
                    onClick={handleExecute}
                    disabled={!filteredProducts.length}
                    className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground py-2.5 rounded-md font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-none"
                  >
                    Aplicar Edição
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

      </div>
    </div >
  );
}
