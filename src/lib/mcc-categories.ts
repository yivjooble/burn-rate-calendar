// MCC (Merchant Category Code) to human-readable category mapping
// Based on ISO 18245 standard

export interface Category {
  name: string;
  icon: string;
  color: string;
}

// Group MCC codes into broader categories
export const MCC_CATEGORIES: Record<string, Category> = {
  "groceries": { name: "Продукти", icon: "🛒", color: "#22c55e" },
  "restaurants": { name: "Ресторани та кафе", icon: "🍽️", color: "#f97316" },
  "transport": { name: "Транспорт", icon: "🚗", color: "#3b82f6" },
  "utilities": { name: "Комунальні послуги", icon: "💡", color: "#eab308" },
  "entertainment": { name: "Розваги", icon: "🎬", color: "#a855f7" },
  "shopping": { name: "Покупки", icon: "🛍️", color: "#ec4899" },
  "health": { name: "Здоров'я", icon: "💊", color: "#14b8a6" },
  "education": { name: "Освіта", icon: "📚", color: "#6366f1" },
  "travel": { name: "Подорожі", icon: "✈️", color: "#0ea5e9" },
  "services": { name: "Послуги", icon: "🔧", color: "#64748b" },
  "transfers": { name: "Перекази", icon: "💸", color: "#8b5cf6" },
  "mobile": { name: "Мобільний зв'язок", icon: "📱", color: "#06b6d4" },
  "cash": { name: "Готівка", icon: "💵", color: "#84cc16" },
  "charity": { name: "Благодійність", icon: "❤️", color: "#ef4444" },
  "other": { name: "Інше", icon: "📦", color: "#94a3b8" },
};

// Detect category based on transaction description
export function getCategoryFromDescription(description: string): string | null {
  const desc = description.toLowerCase();
  
  // Transfers
  if (desc.includes("переказ") || desc.includes("на картку") || desc.includes("поповнення «")) {
    return "transfers";
  }
  
  // Mobile top-up
  if (desc.includes("lifecell") || desc.includes("vodafone") || desc.includes("київстар") || 
      desc.includes("kyivstar") || desc.includes("+380")) {
    return "mobile";
  }
  
  // Charity / Donations
  if (desc.includes("збір") || desc.includes("омбр") || desc.includes("зсу") || 
      desc.includes("донат") || desc.includes("благодійн")) {
    return "charity";
  }
  
  return null;
}

// Map MCC codes to category keys
export function getMccCategory(mcc: number): string {
  // Groceries (5411-5499)
  if (mcc >= 5411 && mcc <= 5499) return "groceries";
  if (mcc === 5311 || mcc === 5331) return "groceries"; // Department stores, variety stores
  
  // Restaurants & Food (5812-5814)
  if (mcc >= 5812 && mcc <= 5814) return "restaurants";
  if (mcc === 5462) return "restaurants"; // Bakeries
  if (mcc === 5441) return "restaurants"; // Candy stores
  if (mcc === 5921) return "restaurants"; // Package stores (alcohol)
  
  // Transport
  if (mcc >= 4011 && mcc <= 4789) return "transport"; // Transportation services
  if (mcc >= 5511 && mcc <= 5599) return "transport"; // Auto dealers, gas stations
  if (mcc === 4121) return "transport"; // Taxi
  if (mcc === 4131) return "transport"; // Bus lines
  if (mcc === 7512) return "transport"; // Car rental
  
  // Utilities
  if (mcc >= 4812 && mcc <= 4900) return "utilities"; // Telecom, utilities
  if (mcc === 4814) return "utilities"; // Telecom
  if (mcc === 4816) return "utilities"; // Computer network services
  
  // Entertainment
  if (mcc >= 7832 && mcc <= 7841) return "entertainment"; // Movies
  if (mcc >= 7911 && mcc <= 7999) return "entertainment"; // Recreation
  if (mcc === 5735) return "entertainment"; // Record stores
  if (mcc === 5815 || mcc === 5816 || mcc === 5817 || mcc === 5818) return "entertainment"; // Digital goods
  
  // Shopping / Retail
  if (mcc >= 5200 && mcc <= 5399) return "shopping"; // Home supplies, retail
  if (mcc >= 5600 && mcc <= 5699) return "shopping"; // Apparel
  if (mcc >= 5700 && mcc <= 5799) return "shopping"; // Home furnishings
  if (mcc >= 5900 && mcc <= 5999) return "shopping"; // Misc retail
  if (mcc === 5045 || mcc === 5046) return "shopping"; // Computers
  if (mcc === 5732) return "shopping"; // Electronics
  if (mcc === 5942) return "shopping"; // Book stores
  if (mcc === 5944) return "shopping"; // Jewelry
  if (mcc === 5945) return "shopping"; // Hobby/toy stores
  
  // Health
  if (mcc >= 5912 && mcc <= 5912) return "health"; // Drug stores
  if (mcc >= 8011 && mcc <= 8099) return "health"; // Medical services
  if (mcc === 5975 || mcc === 5976 || mcc === 5977) return "health"; // Hearing aids, orthopedic
  
  // Education
  if (mcc >= 8211 && mcc <= 8299) return "education"; // Schools
  if (mcc === 5111) return "education"; // Stationery
  if (mcc === 5192) return "education"; // Books, periodicals
  
  // Travel
  if (mcc >= 3000 && mcc <= 3999) return "travel"; // Airlines, hotels
  if (mcc >= 7011 && mcc <= 7033) return "travel"; // Hotels, lodging
  if (mcc === 4722) return "travel"; // Travel agencies
  
  // Services
  if (mcc >= 7210 && mcc <= 7299) return "services"; // Personal services
  if (mcc >= 7311 && mcc <= 7399) return "services"; // Business services
  if (mcc >= 7500 && mcc <= 7549) return "services"; // Auto services
  if (mcc >= 8111 && mcc <= 8999) return "services"; // Professional services
  
  // Transfers & Financial
  if (mcc === 6010 || mcc === 6011) return "cash"; // ATM, cash
  if (mcc >= 6012 && mcc <= 6099) return "transfers"; // Financial institutions
  if (mcc === 4829) return "transfers"; // Money orders
  
  return "other";
}

export function getCategoryInfo(mcc: number): Category {
  const categoryKey = getMccCategory(mcc);
  return MCC_CATEGORIES[categoryKey] || MCC_CATEGORIES["other"];
}

export function getCategoryByKey(key: string): Category {
  return MCC_CATEGORIES[key] || MCC_CATEGORIES["other"];
}

export function getAllCategories(): { key: string; category: Category }[] {
  return Object.entries(MCC_CATEGORIES).map(([key, category]) => ({
    key,
    category,
  }));
}
