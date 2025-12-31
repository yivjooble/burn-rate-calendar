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
  "delivery": { name: "Пошта та доставка", icon: "📦", color: "#78716c" },
  "utilities": { name: "Комунальні послуги", icon: "💡", color: "#eab308" },
  "entertainment": { name: "Розваги", icon: "🎬", color: "#a855f7" },
  "shopping": { name: "Покупки", icon: "🛍️", color: "#ec4899" },
  "health": { name: "Здоров'я", icon: "💊", color: "#14b8a6" },
  "education": { name: "Освіта", icon: "📚", color: "#6366f1" },
  "travel": { name: "Подорожі", icon: "✈️", color: "#0ea5e9" },
  "services": { name: "Послуги", icon: "🔧", color: "#64748b" },
  "subscriptions": { name: "Підписки", icon: "📋", color: "#7c3aed" },
  "transfers": { name: "Перекази", icon: "💸", color: "#8b5cf6" },
  "mobile": { name: "Мобільний зв'язок", icon: "📱", color: "#06b6d4" },
  "cash": { name: "Готівка", icon: "💵", color: "#84cc16" },
  "charity": { name: "Благодійність", icon: "❤️", color: "#ef4444" },
  "other": { name: "Інше", icon: "❓", color: "#94a3b8" },
};

// Detect category based on transaction description
export function getCategoryFromDescription(description: string): string | null {
  const desc = description.toLowerCase();
  
  // Postal / Delivery services
  if (desc.includes("нова пошта") || desc.includes("nova poshta") || desc.includes("novaposhta") ||
      desc.includes("укрпошта") || desc.includes("ukrposhta") || desc.includes("meest") ||
      desc.includes("міст") || desc.includes("justin") || desc.includes("джастін") ||
      desc.includes("rozetka delivery") || desc.includes("доставка")) {
    return "delivery";
  }
  
  // Utilities - actual utility payments
  if (desc.includes("комунальн") || desc.includes("квартплата") ||
      desc.includes("жкг") || desc.includes("жкх") || desc.includes("осбб") ||
      desc.includes("водоканал") || desc.includes("теплоенерг") ||
      desc.includes("газопостач") || desc.includes("облгаз") ||
      desc.includes("обленерго") || desc.includes("енергопостач") ||
      desc.includes("київенерго") || desc.includes("його")) {
    return "utilities";
  }
  
  // Subscriptions / Digital services
  if (desc.includes("netflix") || desc.includes("spotify") || desc.includes("youtube") ||
      desc.includes("apple") || desc.includes("google play") || desc.includes("steam") ||
      desc.includes("microsoft") || desc.includes("adobe") || desc.includes("chatgpt") ||
      desc.includes("openai") || desc.includes("notion") || desc.includes("figma") ||
      desc.includes("megogo") || desc.includes("мегого") || desc.includes("підписка")) {
    return "subscriptions";
  }
  
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
  
  // Transport - taxis, ride-sharing, fuel
  if (desc.includes("bolt") || desc.includes("uber") || desc.includes("uklon") ||
      desc.includes("уклон") || desc.includes("таксі") || desc.includes("taxi") ||
      desc.includes("wog") || desc.includes("okko") || desc.includes("upg") ||
      desc.includes("азс") || desc.includes("бензин") || desc.includes("пальне") ||
      desc.includes("pkp") || desc.includes("укрзалізниця") || desc.includes("залізничн")) {
    return "transport";
  }
  
  // Groceries - supermarkets
  if (desc.includes("атб") || desc.includes("atb") || desc.includes("сільпо") ||
      desc.includes("фора") || desc.includes("fora") || desc.includes("новус") ||
      desc.includes("novus") || desc.includes("ашан") || desc.includes("auchan") ||
      desc.includes("метро") || desc.includes("metro") || desc.includes("варус") ||
      desc.includes("костор") || desc.includes("екомаркет") || desc.includes("гастроном")) {
    return "groceries";
  }
  
  // Restaurants / Food delivery
  if (desc.includes("glovo") || desc.includes("глово") || desc.includes("raketa") ||
      desc.includes("mcdonald") || desc.includes("макдональд") ||
      desc.includes("kfc") || desc.includes("pizza") || desc.includes("піца")) {
    return "restaurants";
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
