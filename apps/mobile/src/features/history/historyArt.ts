import type { ActivityKind } from '@/data/models';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import type { ListRowArt } from '@/ui/ListRow';

import CoverLetterIcon from '../../../assets/icons/create/cover-letter.svg';
import AccountIcon from '../../../assets/icons/history/account.svg';
import BillingIcon from '../../../assets/icons/history/billing.svg';
import BookmarkIcon from '../../../assets/icons/history/bookmark.svg';
import ExportIcon from '../../../assets/icons/history/export.svg';
import PaperPlaneIcon from '../../../assets/icons/history/paper-plane.svg';
import AtsCheckTile from '../../../assets/icons/history/tile-ats-check.svg';
import GenerationTile from '../../../assets/icons/history/tile-generation.svg';
import InterviewIcon from '../../../assets/icons/shortcuts/interview-prep.svg';

/**
 * How an activity's leading tile is drawn (HISTORY 01, 580:2964 … 580:3181). Two kinds are whole
 * drawings that bring their own tile; the rest are a drawing on the lavender tile, at the width
 * the board sets it.
 */
export type ActivityTileArt =
  { kind: 'tile'; art: ListRowArt } | { kind: 'icon'; art: ListRowArt; width: number };

export const ACTIVITY_TILE_ART: Record<ActivityKind, ActivityTileArt> = {
  generation: { kind: 'tile', art: { Icon: GenerationTile, w: 40, h: 39.995 } },
  ats_check: { kind: 'tile', art: { Icon: AtsCheckTile, w: 40, h: 38.9773 } },
  score: { kind: 'icon', art: PROFILE_ROW_ART.desiredRoles, width: 31 },
  export: { kind: 'icon', art: { Icon: ExportIcon, w: 30.7692, h: 19.0225 }, width: 30.7692 },
  profile: { kind: 'icon', art: { Icon: AccountIcon, w: 33.9995, h: 26.3173 }, width: 34 },
  saved_job: { kind: 'icon', art: { Icon: BookmarkIcon, w: 33.9989, h: 24.5472 }, width: 34 },
  plan: { kind: 'icon', art: { Icon: BillingIcon, w: 34.001, h: 31.4241 }, width: 34 },
  application: {
    kind: 'icon',
    art: { Icon: PaperPlaneIcon, w: 33.9993, h: 25.2462 },
    width: 34,
  },
  // Not drawn on HISTORY 01: the create sheet's letter and Home's interview-prep drawings, sized
  // to sit in the tile like the others.
  cover_letter: { kind: 'icon', art: { Icon: CoverLetterIcon, w: 39, h: 38.4613 }, width: 28 },
  interview: { kind: 'icon', art: { Icon: InterviewIcon, w: 44, h: 44.1229 }, width: 28 },
};
