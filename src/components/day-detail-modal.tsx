"use client";

import { useState } from "react";
import { DayBudget, getCurrencySymbol } from "@/types";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, TrendingDown, TrendingUp, Banknote, EyeOff, Eye, Tags, ChevronDown, Plus } from "lucide-react";
import { isCashWithdrawal, isInternalTransfer } from "@/lib/monobank";
import { useBudgetStore } from "@/store/budget-store";
import { getAllCategories, getCategoryFromDescription, getMccCategory } from "@/lib/mcc-categories";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DayDetailModalProps {
  day: DayBudget;
  onClose: () => void;
  onExcludeTransaction?: (transactionId: string) => void;
}

export function DayDetailModal({ day, onClose, onExcludeTransaction }: DayDetailModalProps) {
  const { 
    excludedTransactionIds, 
    excludeTransaction, 
    includeTransaction,
    transactionCategories,
    setTransactionCategory,
    customCategories,
    addCustomCategory,
  } = useBudgetStore();
  const percentUsed = day.limit > 0 ? (day.spent / day.limit) * 100 : 0;
  
  // Check if we have mixed currencies
  const currencyCodes = [...new Set(day.transactions.map(tx => tx.currencyCode).filter(Boolean))];
  const hasMixedCurrencies = currencyCodes.length > 1 || (currencyCodes.length === 1 && currencyCodes[0] !== 980);
  
  // For aggregated values (spent, limit, remaining) always show in UAH since budget is in UAH
  // Individual transactions show their own currency
  
  // State for new category dialog
  const [newCategoryDialogOpen, setNewCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📁");
  const [newCategoryColor, setNewCategoryColor] = useState("#6366f1");
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const newCategory = {
      id: `custom-${Date.now()}`,
      name: newCategoryName.trim(),
      icon: newCategoryIcon,
      color: newCategoryColor,
    };
    
    addCustomCategory(newCategory);
    
    // If there's a pending transaction, assign it to the new category
    if (pendingTransactionId) {
      setTransactionCategory(pendingTransactionId, newCategory.id);
      setPendingTransactionId(null);
    }
    
    setNewCategoryName("");
    setNewCategoryIcon("📁");
    setNewCategoryColor("#6366f1");
    setNewCategoryDialogOpen(false);
  };

  const openNewCategoryDialog = (transactionId?: string) => {
    if (transactionId) {
      setPendingTransactionId(transactionId);
    }
    setNewCategoryDialogOpen(true);
  };
  
  // Get all available categories (standard + custom)
  const allCategories = [
    ...getAllCategories(),
    ...customCategories.map(c => ({ key: c.id, category: { name: c.name, icon: c.icon, color: c.color } })),
  ];
  
  // Get current category for a transaction
  const getTransactionCategoryInfo = (txId: string, txDescription: string, txMcc: number) => {
    const customCatId = transactionCategories[txId];
    if (customCatId) {
      const cat = allCategories.find(c => c.key === customCatId);
      return cat ? { key: customCatId, ...cat.category, isCustom: true } : null;
    }
    const descCat = getCategoryFromDescription(txDescription);
    if (descCat) {
      const cat = allCategories.find(c => c.key === descCat);
      return cat ? { key: descCat, ...cat.category, isCustom: false } : null;
    }
    const mccCat = getMccCategory(txMcc);
    const cat = allCategories.find(c => c.key === mccCat);
    return cat ? { key: mccCat, ...cat.category, isCustom: false } : null;
  };
  
  // Separate transactions into expenses, cash withdrawals, and internal transfers
  // Also filter out manually excluded transactions
  const expenses = day.transactions.filter(tx => 
    tx.amount < 0 && 
    !isCashWithdrawal(tx) && 
    !isInternalTransfer(tx, day.transactions) &&
    !excludedTransactionIds.includes(tx.id)
  );
  const cashWithdrawals = day.transactions.filter(tx => 
    tx.amount < 0 && isCashWithdrawal(tx)
  );
  const internalTransfers = day.transactions.filter(tx => 
    isInternalTransfer(tx, day.transactions) && !isCashWithdrawal(tx)
  );
  const manuallyExcluded = day.transactions.filter(tx =>
    excludedTransactionIds.includes(tx.id)
  );
  const incomes = day.transactions.filter(tx => 
    tx.amount > 0 && !isInternalTransfer(tx, day.transactions)
  );

  const handleExclude = (transactionId: string) => {
    excludeTransaction(transactionId);
    onExcludeTransaction?.(transactionId);
  };

  const handleInclude = (transactionId: string) => {
    includeTransaction(transactionId);
    onExcludeTransaction?.(transactionId);
  };

  const getStatusBadge = () => {
    switch (day.status) {
      case "over":
        return <Badge variant="destructive">Перевищено</Badge>;
      case "warning":
        return <Badge className="bg-orange-500">Увага</Badge>;
      default:
        return <Badge className="bg-emerald-500">В нормі</Badge>;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 md:p-4"
      onClick={onClose}
    >
      <Card
        className="w-full md:max-w-lg h-[85vh] md:h-auto md:max-h-[85vh] overflow-hidden rounded-t-2xl md:rounded-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2 flex-shrink-0">
          <CardTitle className="text-base md:text-lg">
            {format(day.date, "d MMMM yyyy", { locale: uk })}
          </CardTitle>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4 pb-6 md:pb-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Статус</span>
            {getStatusBadge()}
          </div>

          <div className="grid grid-cols-3 gap-1.5 md:gap-2 text-center">
            <div className="p-2 bg-muted rounded-lg">
              <div className="text-base md:text-lg font-bold text-red-500">
                {(day.spent / 100).toFixed(0)} ₴
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground">Витрачено</div>
            </div>
            <div className="p-2 bg-muted rounded-lg">
              <div className="text-base md:text-lg font-bold">
                {(day.limit / 100).toFixed(0)} ₴
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground">Ліміт</div>
            </div>
            <div className="p-2 bg-muted rounded-lg">
              <div
                className={`text-base md:text-lg font-bold ${
                  day.remaining >= 0 ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {(day.remaining / 100).toFixed(0)} ₴
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground">Залишок</div>
            </div>
          </div>

          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full transition-all ${
                percentUsed > 100
                  ? "bg-red-500"
                  : percentUsed > 80
                  ? "bg-orange-400"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
          <div className="text-center text-sm text-muted-foreground">
            {percentUsed.toFixed(0)}% від денного ліміту
          </div>

          <Separator />

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {/* Expenses */}
            {expenses.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  Витрати ({expenses.length})
                </h4>
                <div className="space-y-1">
                  {expenses.map((tx) => {
                    const catInfo = getTransactionCategoryInfo(tx.id, tx.description, tx.mcc);
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-2 bg-red-50 rounded-lg group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{tx.description}</div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-0.5">
                                <span>{catInfo?.icon}</span>
                                <span>{catInfo?.name}</span>
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                              {allCategories.map(({ key, category }) => (
                                <DropdownMenuItem
                                  key={key}
                                  onClick={() => setTransactionCategory(tx.id, key)}
                                  className="cursor-pointer"
                                >
                                  <span>{category.icon}</span>
                                  <span>{category.name}</span>
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openNewCategoryDialog(tx.id)}
                                className="cursor-pointer text-blue-600"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Створити категорію</span>
                              </DropdownMenuItem>
                              {transactionCategories[tx.id] && (
                                <DropdownMenuItem
                                  onClick={() => setTransactionCategory(tx.id, null)}
                                  className="cursor-pointer text-muted-foreground"
                                >
                                  Скинути категорію
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 font-medium text-red-500">
                            <TrendingDown className="w-3 h-3" />
                            {(Math.abs(tx.amount) / 100).toFixed(2)} {getCurrencySymbol(tx.currencyCode)}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            onClick={() => handleExclude(tx.id)}
                            title="Не враховувати"
                          >
                            <EyeOff className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cash Withdrawals */}
            {cashWithdrawals.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-blue-500" />
                  Зняття готівки ({cashWithdrawals.length})
                  <Badge variant="outline" className="text-[10px] ml-1">не враховано</Badge>
                </h4>
                <div className="space-y-1">
                  {cashWithdrawals.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-2 bg-blue-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{tx.description}</div>
                      </div>
                      <div className="flex items-center gap-1 font-medium text-blue-500">
                        <Banknote className="w-3 h-3" />
                        {(Math.abs(tx.amount) / 100).toFixed(2)} {getCurrencySymbol(tx.currencyCode)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Incomes */}
            {incomes.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Надходження ({incomes.length})
                </h4>
                <div className="space-y-1">
                  {incomes.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{tx.description}</div>
                      </div>
                      <div className="flex items-center gap-1 font-medium text-emerald-500">
                        <TrendingUp className="w-3 h-3" />
                        {(Math.abs(tx.amount) / 100).toFixed(2)} {getCurrencySymbol(tx.currencyCode)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Internal Transfers */}
            {internalTransfers.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2 text-muted-foreground">
                  Внутрішні перекази ({internalTransfers.length})
                  <Badge variant="outline" className="text-[10px] ml-1">не враховано</Badge>
                </h4>
                <div className="space-y-1">
                  {internalTransfers.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-muted-foreground">{tx.description}</div>
                      </div>
                      <div className="flex items-center gap-1 font-medium text-muted-foreground">
                        {(Math.abs(tx.amount) / 100).toFixed(2)} {getCurrencySymbol(tx.currencyCode)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manually Excluded */}
            {manuallyExcluded.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2 text-muted-foreground">
                  <EyeOff className="w-4 h-4" />
                  Вручну виключені ({manuallyExcluded.length})
                </h4>
                <div className="space-y-1">
                  {manuallyExcluded.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-muted-foreground line-through">{tx.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 font-medium text-muted-foreground">
                          {(Math.abs(tx.amount) / 100).toFixed(2)} {getCurrencySymbol(tx.currencyCode)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          onClick={() => handleInclude(tx.id)}
                          title="Повернути до витрат"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {day.transactions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Немає транзакцій
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* New Category Dialog */}
      <Dialog open={newCategoryDialogOpen} onOpenChange={setNewCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Створити нову категорію</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="modal-category-name">Назва</Label>
              <Input
                id="modal-category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Наприклад: Підписки"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modal-category-icon">Іконка (emoji)</Label>
                <Input
                  id="modal-category-icon"
                  value={newCategoryIcon}
                  onChange={(e) => setNewCategoryIcon(e.target.value)}
                  placeholder="📁"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-category-color">Колір</Label>
                <Input
                  id="modal-category-color"
                  type="color"
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  className="h-10 p-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-xl">{newCategoryIcon}</span>
              <span className="font-medium" style={{ color: newCategoryColor }}>
                {newCategoryName || "Попередній перегляд"}
              </span>
            </div>
            <Button onClick={handleCreateCategory} className="w-full" disabled={!newCategoryName.trim()}>
              Створити категорію
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
