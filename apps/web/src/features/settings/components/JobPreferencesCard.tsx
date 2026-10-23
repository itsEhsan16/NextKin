'use client';

import type { ProfilePreferences } from '@nextkin/shared/models';
import { EMPLOYMENT_TYPE_LABEL, REMOTE_PREFERENCE_LABEL } from '@nextkin/shared/models';
import { useUpdatePreferences } from '@nextkin/shared/queries';
import { useState } from 'react';

import { AccountCard } from '@/features/account/components/AccountCard';
import { Checkbox } from '@/ui/Checkbox';
import { ChipsField } from '@/ui/ChipsField';
import { ProfileExperienceIllustration } from '@/ui/illustrations';
import { SelectField } from '@/ui/SelectField';

import {
  INDUSTRY_OPTIONS,
  JOB_TYPE_OPTIONS,
  LOCATION_OPTIONS,
  WORK_MODE_OPTIONS,
  withChosen,
} from '../preferencesLibrary';
import { CardAction } from './CardAction';
import { FieldRow } from './FieldRow';
import { SalaryField } from './SalaryField';

/**
 * "Job preferences" (356:7): what matches and alerts look for, from the same preferences the
 * Account page's Preferences tab reads. By your call the fields stay read-only until Edit, which
 * then reads Done; while editing, each change saves the moment it's made (`toreview.md` §22).
 */
export function JobPreferencesCard({ preferences }: { preferences: ProfilePreferences }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdatePreferences();
  const save = (patch: Partial<ProfilePreferences>) => update.mutate(patch);

  const types = preferences.employmentTypes ?? [];
  const industries = preferences.industries ?? [];
  const locked = !editing;

  return (
    <AccountCard
      Art={ProfileExperienceIllustration}
      title="Job preferences"
      description="Help us tailor job recommendations to your interests."
      action={
        <CardAction
          label={editing ? 'Done' : 'Edit'}
          accessibleName={editing ? 'Done editing job preferences' : 'Edit job preferences'}
          onClick={() => setEditing((on) => !on)}
        />
      }
    >
      <div className="mt-4">
        <FieldRow label="Preferred job types">
          <div
            role="group"
            aria-label="Preferred job types"
            className="flex flex-wrap gap-x-5 gap-y-2"
          >
            {JOB_TYPE_OPTIONS.map((type) => (
              <Checkbox
                key={type}
                label={EMPLOYMENT_TYPE_LABEL[type]}
                checked={types.includes(type)}
                disabled={locked}
                onChange={(on) =>
                  save({
                    employmentTypes: on
                      ? [...types, type]
                      : types.filter((chosen) => chosen !== type),
                  })
                }
              />
            ))}
          </div>
        </FieldRow>
        <FieldRow label="Preferred work mode">
          <SelectField
            label="Preferred work mode"
            value={preferences.remote}
            options={WORK_MODE_OPTIONS}
            labelOf={(mode) => REMOTE_PREFERENCE_LABEL[mode]}
            onChange={(remote) => save({ remote })}
            disabled={locked}
          />
        </FieldRow>
        <FieldRow label="Preferred locations">
          <ChipsField
            label="Preferred locations"
            values={preferences.locations}
            options={withChosen(LOCATION_OPTIONS, preferences.locations)}
            onChange={(locations) => save({ locations })}
            placeholder="Anywhere"
            disabled={locked}
          />
        </FieldRow>
        <FieldRow label="Industries of interest">
          <ChipsField
            label="Industries of interest"
            values={industries}
            options={withChosen(INDUSTRY_OPTIONS, industries)}
            onChange={(next) => save({ industries: next })}
            placeholder="Any industry"
            disabled={locked}
          />
        </FieldRow>
        <FieldRow label="Minimum salary (optional)">
          <SalaryField
            value={preferences.minSalary}
            onChange={(minSalary) => save({ minSalary })}
            disabled={locked}
          />
        </FieldRow>
      </div>
    </AccountCard>
  );
}
