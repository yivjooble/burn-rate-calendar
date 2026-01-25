import { Transaction } from "@/types";
import { getMccCategory, getCategoryFromDescription, getCategoryByKey, MCC_CATEGORIES, Category } from "./mcc-categories";

export interface CategoryInfo {
  key: string;
  name: string;
  icon: string;
  color: string;
  isCustom: boolean;
}

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/**
 * Get category for a transaction considering manual overrides.
 * Priority order:
 * 1. Manual override (transactionCategories)
 * 2. Description-based detection
 * 3. MCC-based detection
 */
export function getTransactionCategory(
  transaction: Transaction,
  transactionCategories: Record<string, string | null>,
  customCategories: CustomCategory[] = []
): CategoryInfo {
  // Priority 1: Manual override
  const manualCategoryId = transactionCategories[transaction.id];
  if (manualCategoryId) {
    // Check custom categories first
    const customCat = customCategories.find(c => c.id === manualCategoryId);
    if (customCat) {
      return {
        key: customCat.id,
        name: customCat.name,
        icon: customCat.icon,
        color: customCat.color,
        isCustom: true
      };
    }
    // Check standard categories
    const standardCat = MCC_CATEGORIES[manualCategoryId];
    if (standardCat) {
      return {
        key: manualCategoryId,
        name: standardCat.name,
        icon: standardCat.icon,
        color: standardCat.color,
        isCustom: false
      };
    }
  }

  // Priority 2: Description-based detection
  const descCategory = getCategoryFromDescription(transaction.description);
  if (descCategory) {
    const cat = getCategoryByKey(descCategory);
    return {
      key: descCategory,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isCustom: false
    };
  }

  // Priority 3: MCC-based detection
  const mccCategory = getMccCategory(transaction.mcc);
  const cat = getCategoryByKey(mccCategory);
  return {
    key: mccCategory,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    isCustom: false
  };
}

/**
 * Get just the category key for a transaction (without full info).
 * Useful for grouping and filtering operations.
 */
export function getTransactionCategoryKey(
  transaction: Transaction,
  transactionCategories: Record<string, string | null>
): string {
  // Priority 1: Manual override
  const manualCategoryId = transactionCategories[transaction.id];
  if (manualCategoryId) {
    return manualCategoryId;
  }

  // Priority 2: Description-based detection
  const descCategory = getCategoryFromDescription(transaction.description);
  if (descCategory) {
    return descCategory;
  }

  // Priority 3: MCC-based detection
  return getMccCategory(transaction.mcc);
}
