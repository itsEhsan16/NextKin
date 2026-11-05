'use client';

import { useState } from 'react';

import type { TaxonomyCategory } from '@nextkin/shared/models';
import { useAddSkill } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { RadioCardGroup, TextField } from '../../ui/AdminForm';
import { errorMessage } from '../format';

/** "Add skill" (Figma 406:1829): a name, its category and parent, and any aliases. Audited. */
export function AddSkillDialog({
  open,
  onOpenChange,
  categories,
  categoryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TaxonomyCategory[];
  categoryId: string;
}) {
  const add = useAddSkill();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(categoryId);
  // Each opening starts on the category being viewed, not the one open when the page loaded.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCategory(categoryId);
  }
  const [parent, setParent] = useState('');
  const [aliases, setAliases] = useState('');
  const complete = name.trim() && category && parent.trim();

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="Plus"
      tone="brand"
      title="Add a skill"
      description="Resume parsing and the ATS check match it, and its aliases, from now on."
      confirm={{
        label: 'Add skill',
        disabled: !complete,
        busy: add.isPending,
        onConfirm: () =>
          complete &&
          add.mutate(
            {
              name: name.trim(),
              categoryId: category,
              parent: parent.trim(),
              aliases: aliases
                .split(',')
                .map((a) => a.trim())
                .filter(Boolean),
            },
            {
              onSuccess: (skill) => {
                showToast(`${skill.name} added`);
                setName('');
                setParent('');
                setAliases('');
                onOpenChange(false);
              },
              onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
            },
          ),
      }}
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Skill"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pulumi"
        />
        <TextField
          label="Parent category"
          required
          value={parent}
          onChange={(e) => setParent(e.target.value)}
          placeholder="Infrastructure as code"
        />
        <TextField
          label="Aliases"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          placeholder="pulumi-cli"
          hint="Separate with commas."
        />
        <div className="max-h-[220px] overflow-y-auto">
          <RadioCardGroup
            label="Category"
            required
            value={category}
            onChange={setCategory}
            options={categories.map((c) => ({ id: c.id, label: c.name }))}
          />
        </div>
      </div>
    </AdminDialog>
  );
}
