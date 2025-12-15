'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useSplitContext } from '@/context/SplitContext';

export default function PeoplePage() {
  const { persons, addPerson, editPerson, deletePerson } = useSplitContext();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    addPerson(name.trim());
    setName('');
    setError('');
  };

  const startEdit = (personId: string, currentName: string) => {
    setEditingId(personId);
    setEditingName(currentName);
  };

  const saveEdit = (personId: string) => {
    if (!editingName.trim()) {
      setError('Name is required');
      return;
    }
    editPerson(personId, editingName.trim());
    setEditingId(null);
    setEditingName('');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setError('');
  };

  const handleDelete = (personId: string) => {
    if (confirm('Are you sure? This person will be removed from all items.')) {
      deletePerson(personId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">People</h1>
            <p className="text-slate-400">Add and manage who's splitting costs</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-700/70 transition w-fit"
          >
            ← Back to Table
          </Link>
        </div>

        {/* Add New Person Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur mb-8">
          <label className="block text-sm font-semibold text-slate-200 mb-3">Add a new person</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="Enter name (e.g., Sarah, Mom, etc.)"
              autoFocus
              className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-400 transition whitespace-nowrap"
            >
              Add
            </button>
          </div>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        </form>

        {/* People List */}
        <div className="space-y-3">
          {persons.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/30 border border-slate-700 rounded-lg">
              <p className="text-slate-400 text-lg">No people yet.</p>
              <p className="text-slate-500 text-sm mt-1">Add someone above to get started!</p>
            </div>
          ) : (
            persons.map((person, index) => (
              <div
                key={person.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4 hover:bg-slate-800/70 transition"
                style={{
                  borderLeftColor: person.color,
                  borderLeftWidth: '4px',
                }}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Avatar */}
                  <div
                    className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: person.color }}
                  >
                    {person.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name - Editable */}
                  {editingId === person.id ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        className="flex-1 bg-slate-700 text-white px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => saveEdit(person.id)}
                        className="px-3 py-1 rounded bg-green-600 text-white text-xs font-semibold hover:bg-green-500 transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 rounded bg-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-600 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{person.name}</p>
                      <p className="text-xs text-slate-400">ID: {person.id}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {editingId !== person.id && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(person.id, person.name)}
                      className="px-3 py-2 rounded text-xs font-semibold bg-slate-700 text-slate-200 hover:bg-slate-600 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(person.id)}
                      className="px-3 py-2 rounded text-xs font-semibold bg-red-900/30 text-red-300 hover:bg-red-900/50 transition border border-red-700/50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {persons.length > 0 && (
          <div className="mt-8 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-white">{persons.length}</span> {persons.length === 1 ? 'person' : 'people'} added to split costs
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
