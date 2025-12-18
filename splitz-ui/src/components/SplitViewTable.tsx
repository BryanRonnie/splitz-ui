'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { colorUtils, useSplitContext } from '@/context/SplitContext';

const HST_RATE = 0.13;

export default function SplitViewTable() {
  const [mounted, setMounted] = useState(false);
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [feeName, setFeeName] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeHST, setFeeHST] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const { persons, items, fees, addItem, toggleAssignment, updateItemField, addFee, deleteFee, exportCSV, importCSV } = useSplitContext();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const calculateItemTotal = (item: (typeof items)[number]) => {
    const subtotal = item.qty * item.price;
    return item.hst ? subtotal * (1 + HST_RATE) : subtotal;
  };

  const getItemsSubtotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const getFeeTotal = () => {
    return fees.reduce((sum, fee) => {
      const amount = fee.hst ? fee.amount * (1 + HST_RATE) : fee.amount;
      return sum + amount;
    }, 0);
  };

  const getGrandTotal = () => {
    return getItemsSubtotal() + getFeeTotal();
  };

  const getPersonTotal = (personId: string) => {
    // Items for this person
    let personTotal = items
      .filter((item) => item.assignments[personId])
      .reduce((sum, item) => sum + calculateItemTotal(item), 0);

    // Fees for this person
    fees.forEach((fee) => {
      const feeAmount = fee.hst ? fee.amount * (1 + HST_RATE) : fee.amount;
      const splitCount = fee.splitAmong.length > 0 ? fee.splitAmong.length : persons.length;
      const isSplitAmong = fee.splitAmong.length === 0 || fee.splitAmong.includes(personId);
      if (isSplitAmong) {
        personTotal += feeAmount / splitCount;
      }
    });

    return personTotal;
  };

  const handleAddFee = () => {
    if (feeName.trim() && feeAmount) {
      addFee(feeName, parseFloat(feeAmount), feeHST);
      setFeeName('');
      setFeeAmount('');
      setFeeHST(false);
      setShowFeeForm(false);
    }
  };

  const handleExport = () => {
    const csv = exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `splitz-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    importCSV(text);
    setImportFile(null);
  };

  const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/extract-receipt-multipart-nemotron', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('OCR API Response:', data);

      // Parse the nested JSON from response field
      if (data.success && data.response) {
        // Extract JSON from markdown code block
        const jsonMatch = data.response.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[1]);
          console.log('Parsed items:', parsedData.items);
          
          // Add each item to the table
          if (parsedData.items && Array.isArray(parsedData.items)) {
            parsedData.items.forEach((item: any) => {
              addItem(item.name, item.qty, item.price, false);
            });
          }
        }
      }
    } catch (error) {
      console.error('OCR Upload Error:', error);
    }

    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">Splitz</h1>
            <p className="text-slate-400">Smart expense splitter with tax calculations</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              className="rounded-lg border border-green-400/60 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-200 hover:border-green-300 hover:bg-green-500/20"
            >
              Export CSV
            </button>
            <label className="rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 hover:border-amber-300 hover:bg-amber-500/20 cursor-pointer">
              Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <label className="rounded-lg border border-purple-400/60 bg-purple-500/10 px-3 py-2 text-sm font-medium text-purple-200 hover:border-purple-300 hover:bg-purple-500/20 cursor-pointer">
              Upload Receipt
              <input
                type="file"
                accept=".jpeg,.jpg,.png"
                onChange={handleOCRUpload}
                className="hidden"
              />
            </label>
            <Link
              href="/people"
              className="rounded-lg border border-blue-400/60 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-200 hover:border-blue-300 hover:bg-blue-500/20"
            >
              Manage People
            </Link>
          </div>
        </div>

        {/* Per-Person Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur">
            <p className="text-slate-400 text-sm mb-1">Grand Total</p>
            <p className="text-3xl font-bold text-white">${getGrandTotal().toFixed(2)}</p>
          </div>
          {persons.map((person) => (
            <div
              key={person.id}
              className="rounded-lg p-4 border backdrop-blur"
              style={{
                backgroundColor: colorUtils.withAlpha(person.color, 0.15),
                borderColor: colorUtils.withAlpha(person.color, 0.35),
              }}
            >
              <p className="text-sm mb-1 text-slate-300">
                {person.name} Pays
              </p>
              <p className="text-2xl font-bold text-white">
                ${getPersonTotal(person.id).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Mobile View - Stacked Cards */}
        <div className="lg:hidden space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur">
              <div className="mb-3">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="text-slate-400 text-xs block mb-1">QTY</label>
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => updateItemField(item.id, 'qty', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-700 text-white px-2 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Price</label>
                  <input
                    type="number"
                    value={item.price.toFixed(2)}
                    onChange={(e) => updateItemField(item.id, 'price', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-700 text-white px-2 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Total</label>
                  <div className="bg-slate-700 text-white px-2 py-2 rounded text-sm font-semibold">
                    ${calculateItemTotal(item).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <label className="flex items-center gap-2 bg-slate-700/50 px-3 py-2 rounded cursor-pointer hover:bg-slate-700">
                  <input
                    type="checkbox"
                    checked={item.hst}
                    onChange={() => updateItemField(item.id, 'hst', !item.hst)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-slate-300 text-sm">HST (13%)</span>
                  {item.hst && (
                    <span className="text-green-400 text-xs ml-auto">
                      +${(item.qty * item.price * HST_RATE).toFixed(2)}
                    </span>
                  )}
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {persons.map((person) => (
                  <label
                    key={person.id}
                    className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer"
                    style={{
                      backgroundColor: colorUtils.withAlpha(person.color, 0.2),
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(item.assignments[person.id])}
                      onChange={() => toggleAssignment(item.id, person.id)}
                      className="w-4 h-4 cursor-pointer"
                      style={{ accentColor: person.color }}
                    />
                    <span className="text-sm text-white">
                      {person.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Fees Section - Mobile */}
          {fees.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur">
              <h3 className="text-white font-semibold mb-3">Fees & Adjustments</h3>
              {fees.map((fee) => (
                <div key={fee.id} className="flex justify-between items-center py-2 border-b border-slate-700">
                  <div>
                    <p className="text-white text-sm">{fee.name}</p>
                    <p className="text-slate-400 text-xs">
                      ${fee.amount.toFixed(2)} {fee.hst ? '+ HST' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteFee(fee.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Fee Button - Mobile */}
          <button
            onClick={() => setShowFeeForm(!showFeeForm)}
            className="w-full bg-purple-500/20 border border-purple-400/60 text-purple-200 py-2 rounded-lg hover:bg-purple-500/30"
          >
            + Add Fee
          </button>

          {showFeeForm && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur space-y-3">
              <input
                type="text"
                placeholder="Fee name (e.g., Bag Fee)"
                value={feeName}
                onChange={(e) => setFeeName(e.target.value)}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Amount"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                step="0.01"
                min="0"
              />
              <label className="flex items-center gap-2 bg-slate-700/50 px-3 py-2 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={feeHST}
                  onChange={() => setFeeHST(!feeHST)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-slate-300 text-sm">Apply HST (13%)</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleAddFee}
                  className="flex-1 bg-blue-500 text-white py-2 rounded font-semibold hover:bg-blue-600"
                >
                  Add Fee
                </button>
                <button
                  onClick={() => setShowFeeForm(false)}
                  className="flex-1 bg-slate-700 text-slate-300 py-2 rounded hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden lg:block bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700">
                  <th className="px-4 py-3 text-left font-semibold text-slate-300">Item</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-300">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-300">Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-300">Subtotal</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-300">HST (13%)</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-300">Total</th>
                  {persons.map((person) => (
                    <th
                      key={person.id}
                      className="px-4 py-3 text-center font-semibold text-white"
                    >
                      {person.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                        className="bg-slate-700 text-white px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateItemField(item.id, 'qty', parseInt(e.target.value) || 0)}
                        className="bg-slate-700 text-white px-2 py-1 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 w-16"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={item.price.toFixed(2)}
                        onChange={(e) => updateItemField(item.id, 'price', parseFloat(e.target.value) || 0)}
                        className="bg-slate-700 text-white px-2 py-1 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      ${(item.qty * item.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <label className="flex items-center justify-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.hst}
                          onChange={() => updateItemField(item.id, 'hst', !item.hst)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        {item.hst && (
                          <span className="text-green-400 text-xs">
                            +${(item.qty * item.price * HST_RATE).toFixed(2)}
                          </span>
                        )}
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">
                      ${calculateItemTotal(item).toFixed(2)}
                    </td>
                    {persons.map((person) => (
                      <td key={person.id} className="px-4 py-3 text-center">
                        <label className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={Boolean(item.assignments[person.id])}
                            onChange={() => toggleAssignment(item.id, person.id)}
                            className="w-4 h-4 cursor-pointer"
                            style={{ accentColor: person.color }}
                          />
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Items Subtotal Row */}
                <tr className="bg-amber-950/40 border-b-2 border-amber-600/60">
                  <td className="px-4 py-3 font-bold text-amber-100">Items Subtotal</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-bold text-amber-50">
                    ${items.reduce((sum, item) => sum + (item.qty * item.price), 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-amber-50">
                    ${items.reduce((sum, item) => sum + (item.hst ? item.qty * item.price * HST_RATE : 0), 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-amber-50">
                    ${getItemsSubtotal().toFixed(2)}
                  </td>
                  {persons.map((person) => (
                    <td key={person.id} className="px-4 py-3 text-center font-bold text-amber-50">
                      ${items
                        .filter((item) => item.assignments[person.id])
                        .reduce((sum, item) => sum + calculateItemTotal(item), 0)
                        .toFixed(2)}
                    </td>
                  ))}
                </tr>

                {/* Summary Rows - Fees, Discounts, Adjustments */}
                <tr className="bg-slate-950/60 border-b border-slate-600/40">
                  <td className="px-4 py-3 font-bold text-slate-200">Fees</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-300">
                    ${fees.reduce((sum, fee) => sum + (fee.hst ? fee.amount * HST_RATE : 0), 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-100">
                    ${getFeeTotal().toFixed(2)}
                  </td>
                  {persons.map((person) => {
                    const personFeeTotal = fees.reduce((sum, fee) => {
                      const feeAmount = fee.hst ? fee.amount * (1 + HST_RATE) : fee.amount;
                      const splitCount = fee.splitAmong.length > 0 ? fee.splitAmong.length : persons.length;
                      const isSplitAmong = fee.splitAmong.length === 0 || fee.splitAmong.includes(person.id);
                      return isSplitAmong ? sum + feeAmount / splitCount : sum;
                    }, 0);
                    return (
                      <td key={person.id} className="px-4 py-3 text-center font-semibold text-slate-100">
                        ${personFeeTotal.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>

                {/* Fees Rows */}
                {fees.map((fee) => {
                  const feeTotal = fee.hst ? fee.amount * (1 + HST_RATE) : fee.amount;
                  const splitCount = fee.splitAmong.length > 0 ? fee.splitAmong.length : persons.length;
                  return (
                    <tr key={fee.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-white">{fee.name}</td>
                      <td colSpan={4} className="px-4 py-3 text-right text-slate-300">
                        {fee.hst ? `$${fee.amount.toFixed(2)} + HST` : `$${fee.amount.toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        ${feeTotal.toFixed(2)}
                      </td>
                      {persons.map((person) => {
                        const isSplitAmong = fee.splitAmong.length === 0 || fee.splitAmong.includes(person.id);
                        return (
                          <td key={person.id} className="px-4 py-3 text-center text-white">
                            {isSplitAmong ? `$${(feeTotal / splitCount).toFixed(2)}` : '-'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteFee(fee.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Add Fee Row */}
                {!showFeeForm && (
                  <tr className="border-b border-slate-700">
                    <td colSpan={6 + persons.length} className="px-4 py-3">
                      <button
                        onClick={() => setShowFeeForm(true)}
                        className="text-purple-400 hover:text-purple-300 font-semibold text-sm"
                      >
                        + Add Fee or Adjustment
                      </button>
                    </td>
                  </tr>
                )}

                {showFeeForm && (
                  <tr className="border-b border-slate-700 bg-slate-900/30">
                    <td colSpan={6 + persons.length} className="px-4 py-3">
                      <div className="grid grid-cols-5 gap-3 items-end">
                        <input
                          type="text"
                          placeholder="Fee name"
                          value={feeName}
                          onChange={(e) => setFeeName(e.target.value)}
                          className="bg-slate-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={feeAmount}
                          onChange={(e) => setFeeAmount(e.target.value)}
                          className="bg-slate-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          step="0.01"
                          min="0"
                        />
                        <label className="flex items-center gap-2 bg-slate-700/50 px-3 py-2 rounded cursor-pointer whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={feeHST}
                            onChange={() => setFeeHST(!feeHST)}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <span className="text-slate-300 text-sm">HST</span>
                        </label>
                        <button
                          onClick={handleAddFee}
                          className="bg-blue-500 text-white py-2 rounded font-semibold hover:bg-blue-600"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowFeeForm(false)}
                          className="bg-slate-700 text-slate-300 py-2 rounded hover:bg-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Grand Total Row */}
                <tr className="bg-gradient-to-r from-emerald-900 to-green-900 border-t-2 border-emerald-400">
                  <td className="px-4 py-3 font-bold text-emerald-50 text-lg">TOTAL</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-200 text-lg">
                    ${getGrandTotal().toFixed(2)}
                  </td>
                  {persons.map((person) => (
                    <td key={person.id} className="px-4 py-3 text-center font-bold text-emerald-50 text-lg">
                      ${getPersonTotal(person.id).toFixed(2)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
