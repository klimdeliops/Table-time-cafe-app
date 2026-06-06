'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CartDish {
  id: string;
  name: string;
  nameEn: string | null;
  price: string; // Prisma Decimal → JSON string
  category: string;
  image: string | null;
  isAvailable: boolean;
}

export interface CartItem {
  dish: CartDish;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem:    (dish: CartDish) => void;
  removeItem: (dishId: string) => void;
  updateQty:  (dishId: string, delta: number) => void;
  clearCart:  () => void;
  totalItems: number;
  totalPrice: number;
}

// ── Context ──────────────────────────────────────────────────────────────────

export const CartContext = createContext<CartContextValue>({
  items:      [],
  addItem:    () => {},
  removeItem: () => {},
  updateQty:  () => {},
  clearCart:  () => {},
  totalItems: 0,
  totalPrice: 0,
});

export function useCart(): CartContextValue {
  return useContext(CartContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((dish: CartDish) => {
    setItems(prev => {
      const hit = prev.find(i => i.dish.id === dish.id);
      if (hit) {
        return prev.map(i =>
          i.dish.id === dish.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { dish, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((dishId: string) => {
    setItems(prev => prev.filter(i => i.dish.id !== dishId));
  }, []);

  const updateQty = useCallback((dishId: string, delta: number) => {
    setItems(prev =>
      prev
        .map(i => i.dish.id === dishId ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items],
  );

  const totalPrice = useMemo(
    () => items.reduce((s, i) => s + parseFloat(i.dish.price) * i.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({ items, addItem, removeItem, updateQty, clearCart, totalItems, totalPrice }),
    [items, addItem, removeItem, updateQty, clearCart, totalItems, totalPrice],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
