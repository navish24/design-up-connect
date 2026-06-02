'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Plus, Trash2, GripVertical, Check } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type QType = 'text' | 'single_choice' | 'multi_choice'

interface Question {
  id: string
  order: number
  text: string
  type: QType
  options: string[]
  required: boolean
}

function SortableQuestion({
  q,
  onChange,
  onDelete,
}: {
  q: Question
  onChange: (updated: Question) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id })

  function setField<K extends keyof Question>(field: K, val: Question[K]) {
    onChange({ ...q, [field]: val })
  }

  function addOption() {
    onChange({ ...q, options: [...q.options, ''] })
  }

  function setOption(i: number, val: string) {
    const opts = [...q.options]
    opts[i] = val
    onChange({ ...q, options: opts })
  }

  function removeOption(i: number) {
    onChange({ ...q, options: q.options.filter((_, idx) => idx !== i) })
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-4',
        isDragging ? 'opacity-50 shadow-xl' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <button {...attributes} {...listeners} className="mt-1 text-[var(--text3)] cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical size={16} />
        </button>
        <div className="flex-1 flex flex-col gap-3">
          <input
            value={q.text}
            onChange={e => setField('text', e.target.value)}
            placeholder="Question text…"
            className="font-medium"
          />
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text3)]">Type</label>
              <select value={q.type} onChange={e => setField('type', e.target.value as QType)} className="text-sm">
                <option value="text">Short text</option>
                <option value="single_choice">Single choice</option>
                <option value="multi_choice">Multi choice</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-1.5 text-sm text-[var(--text2)] cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={e => setField('required', e.target.checked)}
                  className="w-auto accent-[var(--accent)]"
                  style={{ width: '14px', padding: 0 }}
                />
                Required
              </label>
            </div>
          </div>

          {(q.type === 'single_choice' || q.type === 'multi_choice') && (
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={opt}
                    onChange={e => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 text-sm"
                  />
                  <button onClick={() => removeOption(i)} className="text-[var(--text3)] hover:text-[var(--red)] transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button onClick={addOption} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 transition-opacity w-fit">
                <Plus size={12} /> Add option
              </button>
            </div>
          )}
        </div>
        <button onClick={onDelete} className="text-[var(--text3)] hover:text-[var(--red)] transition-colors flex-shrink-0 mt-1">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

export default function QuestionnairePage() {
  const { id: exhibitionBrandId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { load() }, [exhibitionBrandId])

  async function load() {
    const { data } = await supabase
      .from('qualification_questions')
      .select('*')
      .eq('exhibition_brand_id', exhibitionBrandId)
      .order('order')
    setQuestions((data ?? []).map(q => ({ ...q, options: q.options ?? [] })))
    setLoading(false)
  }

  function addQuestion() {
    const newQ: Question = {
      id: `new-${Date.now()}`,
      order: questions.length,
      text: '',
      type: 'text',
      options: [],
      required: false,
    }
    setQuestions(qs => [...qs, newQ])
  }

  function updateQuestion(id: string, updated: Question) {
    setQuestions(qs => qs.map(q => q.id === id ? updated : q))
  }

  function deleteQuestion(id: string) {
    setQuestions(qs => qs.filter(q => q.id !== id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setQuestions(qs => {
      const oldIdx = qs.findIndex(q => q.id === active.id)
      const newIdx = qs.findIndex(q => q.id === over.id)
      return arrayMove(qs, oldIdx, newIdx).map((q, i) => ({ ...q, order: i }))
    })
  }

  async function save() {
    setSaving(true)
    // Delete all existing questions and re-insert (simple replace strategy)
    await supabase.from('qualification_questions').delete().eq('exhibition_brand_id', exhibitionBrandId)
    const rows = questions
      .filter(q => q.text.trim())
      .map((q, i) => ({
        exhibition_brand_id: exhibitionBrandId,
        order: i,
        text: q.text,
        type: q.type,
        options: q.type === 'text' ? [] : q.options.filter(Boolean),
        required: q.required,
      }))
    if (rows.length > 0) {
      await supabase.from('qualification_questions').insert(rows)
    }
    await load()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div className="p-8 text-sm text-[var(--text3)]">Loading…</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Qualification Questionnaire</h1>
          <p className="text-sm text-[var(--text3)] mt-0.5">Visitors will answer these when scanning your QR at this exhibition</p>
        </div>
        <Button onClick={save} loading={saving} disabled={saving}>
          {saved ? <><Check size={14} /> Saved</> : 'Save'}
        </Button>
      </div>

      {questions.length === 0 && (
        <div className="text-center py-10 text-sm text-[var(--text3)] border border-dashed border-[var(--border)] rounded-2xl mb-6">
          No questions yet. Add one below.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3 mb-4">
            {questions.map(q => (
              <SortableQuestion
                key={q.id}
                q={q}
                onChange={updated => updateQuestion(q.id, updated)}
                onDelete={() => deleteQuestion(q.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button variant="secondary" onClick={addQuestion}>
        <Plus size={14} /> Add Question
      </Button>
    </div>
  )
}
