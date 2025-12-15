'use client';

import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import rawItems from '@/data/items.json';

export type Person = {
  id: string;
  name: string;
  color: string;
  textColor: string;
};

export type Item = {
  id: number;
  name: string;
  qty: number;
  price: number;
  hst: boolean;
  assignments: Record<string, boolean>;
};

export type Fee = {
  id: string;
  name: string;
  amount: number;
  hst: boolean;
  splitAmong: string[]; // personIds to split among, or empty for all
};

type SplitContextValue = {
  persons: Person[];
  items: Item[];
  fees: Fee[];
  addPerson: (name: string) => void;
  editPerson: (personId: string, newName: string) => void;
  deletePerson: (personId: string) => void;
  addItem: (name: string, qty: number, price: number, hst: boolean) => void;
  toggleAssignment: (itemId: number, personId: string) => void;
  updateItemField: (itemId: number, field: keyof Omit<Item, 'assignments'>, value: number | string | boolean) => void;
  addFee: (name: string, amount: number, hst: boolean) => void;
  updateFee: (feeId: string, updates: Partial<Fee>) => void;
  deleteFee: (feeId: string) => void;
  exportCSV: () => string;
  importCSV: (csv: string) => void;
};

const SplitContext = createContext<SplitContextValue | undefined>(undefined);

const BASE_PERSONS: Person[] = [
  { id: 'person1', name: 'Person 1', color: '#38bdf8', textColor: '#0b1220' },
  { id: 'person2', name: 'Person 2', color: '#c084fc', textColor: '#0b1220' },
  { id: 'person3', name: 'Person 3', color: '#f472b6', textColor: '#0b1220' },
];

const HSL_TO_RGB = (h: number, s: number, l: number) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [f(0), f(8), f(4)];
};

const toHex = (value: number) => Math.round(value * 255).toString(16).padStart(2, '0');

const randomColor = () => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 0.68;
  const lightness = 0.55;
  const [r, g, b] = HSL_TO_RGB(hue, saturation, lightness);
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const textColor = luminance > 0.55 ? '#0b1220' : '#f8fafc';
  return { color: hex, textColor };
};

const withAlpha = (hex: string, alpha: number) => {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
};

const hydrateItems = (persons: Person[]): Item[] => {
  return rawItems.map((item) => ({
    id: item.id,
    name: item.name,
    qty: item.qty,
    price: item.price,
    hst: item.hst,
    assignments: {
      [persons[0].id]: Boolean((item as any).person1),
      [persons[1].id]: Boolean((item as any).person2),
      [persons[2].id]: Boolean((item as any).person3),
    },
  }));
};

export function SplitProvider({ children }: { children: ReactNode }) {
  const [persons, setPersons] = useState<Person[]>(BASE_PERSONS);
  const [items, setItems] = useState<Item[]>(() => hydrateItems(BASE_PERSONS));

  const addPerson = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const { color, textColor } = randomColor();
    const newPerson: Person = {
      id: `person-${Date.now()}`,
      name: cleanName,
      color,
      textColor,
    };
    setPersons((prev) => [...prev, newPerson]);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        assignments: { ...item.assignments, [newPerson.id]: false },
      }))
    );
  };

  const editPerson = (personId: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) return;
    setPersons((prev) =>
      prev.map((person) =>
        person.id === personId ? { ...person, name: cleanName } : person
      )
    );
  };

  const deletePerson = (personId: string) => {
    setPersons((prev) => prev.filter((person) => person.id !== personId));
    setItems((prev) =>
      prev.map((item) => {
        const { [personId]: _, ...rest } = item.assignments;
        return { ...item, assignments: rest };
      })
    );
  };

  const addItem = (name: string, qty: number, price: number, hst: boolean) => {
    const cleanName = name.trim();
    if (!cleanName || qty <= 0 || price <= 0) return;
    
    setItems((prev) => {
      const newId = prev.length > 0 ? Math.max(...prev.map(i => i.id)) + 1 : 1;
      const assignments: Record<string, boolean> = {};
      persons.forEach(p => {
        assignments[p.id] = false;
      });
      
      const newItem: Item = {
        id: newId,
        name: cleanName,
        qty,
        price,
        hst,
        assignments,
      };
      
      return [...prev, newItem];
    });
  };

  const toggleAssignment = (itemId: number, personId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              assignments: {
                ...item.assignments,
                [personId]: !item.assignments[personId],
              },
            }
          : item
      )
    );
  };

  const updateItemField = (itemId: number, field: keyof Omit<Item, 'assignments'>, value: number | string | boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const [fees, setFees] = useState<Fee[]>([]);

  const addFee = (name: string, amount: number, hst: boolean) => {
    const cleanName = name.trim();
    if (!cleanName || amount <= 0) return;
    const newFee: Fee = {
      id: `fee-${Date.now()}`,
      name: cleanName,
      amount,
      hst,
      splitAmong: [], // empty means split among all
    };
    setFees((prev) => [...prev, newFee]);
  };

  const updateFee = (feeId: string, updates: Partial<Fee>) => {
    setFees((prev) =>
      prev.map((fee) =>
        fee.id === feeId ? { ...fee, ...updates } : fee
      )
    );
  };

  const deleteFee = (feeId: string) => {
    setFees((prev) => prev.filter((fee) => fee.id !== feeId));
  };

  const exportCSV = () => {
    // Build headers
    const personNames = persons.map((p) => p.name);
    const personPaysNames = persons.map((p) => `${p.name} (Pays)`);
    const headers = [
      'Item Name',
      'Qty',
      'Price',
      'HST?',
      'HST Amount',
      'Price incl Tax',
      ...personNames,
      ...personPaysNames,
    ];

    const rows: string[][] = [];

    // Add items
    items.forEach((item) => {
      const itemTotal = item.price * item.qty;
      const hstAmount = item.hst ? itemTotal * 0.13 : 0;
      const totalWithTax = itemTotal + hstAmount;

      const assignments = persons.map((p) => item.assignments[p.id] ? 'X' : '');
      const pays = persons.map((p) => {
        if (!item.assignments[p.id]) return '';
        const assignedCount = Object.values(item.assignments).filter(Boolean).length;
        return (totalWithTax / assignedCount).toFixed(2);
      });

      rows.push([
        item.name,
        item.qty.toString(),
        item.price.toFixed(2),
        item.hst ? 'Yes' : 'No',
        hstAmount.toFixed(2),
        totalWithTax.toFixed(2),
        ...assignments,
        ...pays,
      ]);
    });

    // Add fees section
    if (fees.length > 0) {
      rows.push(['', '', '', '', '', '', ...new Array(personNames.length * 2).fill('')]);
      rows.push(['Fees & Adjustments', '', '', '', '', '', ...new Array(personNames.length * 2).fill('')]);

      fees.forEach((fee) => {
        const feeTotal = fee.hst ? fee.amount * 1.13 : fee.amount;
        const splitCount = fee.splitAmong.length > 0 ? fee.splitAmong.length : persons.length;

        const assignments = persons.map((p) => {
          const isSplitAmong = fee.splitAmong.length === 0 || fee.splitAmong.includes(p.id);
          return isSplitAmong ? 'X' : '';
        });

        const pays = persons.map((p) => {
          const isSplitAmong = fee.splitAmong.length === 0 || fee.splitAmong.includes(p.id);
          return isSplitAmong ? (feeTotal / splitCount).toFixed(2) : '';
        });

        rows.push([
          fee.name,
          '',
          fee.amount.toFixed(2),
          fee.hst ? 'Yes' : 'No',
          fee.hst ? (fee.amount * 0.13).toFixed(2) : '0.00',
          feeTotal.toFixed(2),
          ...assignments,
          ...pays,
        ]);
      });
    }

    // Build CSV
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    return csv;
  };

  const importCSV = (csv: string) => {
    try {
      const lines = csv.split('\n').filter((line) => line.trim());
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
      const itemNameIdx = headers.indexOf('Item Name');
      const qtyIdx = headers.indexOf('Qty');
      const priceIdx = headers.indexOf('Price');
      const hstIdx = headers.indexOf('HST?');

      if (itemNameIdx === -1 || qtyIdx === -1 || priceIdx === -1) return;

      // Find person name columns
      const personIndices: Record<string, number> = {};
      persons.forEach((person) => {
        const idx = headers.indexOf(person.name);
        if (idx !== -1) {
          personIndices[person.id] = idx;
        }
      });

      // Parse items
      const newItems: Item[] = [];
      lines.slice(1).forEach((line) => {
        if (!line.trim() || line.includes('Fees & Adjustments') || line.includes('Item Name')) return;

        const cells = line.split(',').map((c) => c.replace(/"/g, '').trim());
        const name = cells[itemNameIdx];
        const qty = parseInt(cells[qtyIdx]) || 0;
        const price = parseFloat(cells[priceIdx]) || 0;
        const hst = cells[hstIdx]?.toLowerCase() === 'yes';

        if (!name || qty === 0 || price === 0) return;

        const newItem: Item = {
          id: Math.max(0, ...items.map((i) => i.id)) + 1,
          name,
          qty,
          price,
          hst,
          assignments: {},
        };

        // Assign based on columns
        Object.entries(personIndices).forEach(([personId, idx]) => {
          newItem.assignments[personId] = cells[idx]?.toUpperCase() === 'X';
        });

        newItems.push(newItem);
      });

      if (newItems.length > 0) {
        setItems(newItems);
      }
    } catch (e) {
      console.error('CSV import failed:', e);
    }
  };

  const value = useMemo(
    () => ({
      persons,
      items,
      fees,
      addPerson,
      editPerson,
      deletePerson,
      addItem,
      toggleAssignment,
      updateItemField,
      addFee,
      updateFee,
      deleteFee,
      exportCSV,
      importCSV,
    }),
    [persons, items, fees]
  );

  return <SplitContext.Provider value={value}>{children}</SplitContext.Provider>;
}

export const useSplitContext = () => {
  const ctx = useContext(SplitContext);
  if (!ctx) {
    throw new Error('useSplitContext must be used within a SplitProvider');
  }
  return ctx;
};

export const colorUtils = { withAlpha };
