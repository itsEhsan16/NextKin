/**
 * The plain line icons of the web: Hugeicons since 2026-11-13 (owner: "all of web, but only where
 * we do not have any custom icons"), drawn from `hugeIcons`. The names are Untitled UI's, the set
 * these replaced (toreview §131), so no call site changed; mobile's `gen-hugeicons.cjs` maps the
 * same names to the same glyphs. Size them with `iconSize`; they stroke in `currentColor`.
 */
import { hugeIcon } from './hugeIcons';

export const AlertCircle = hugeIcon('AlertCircle');
export const AlertTriangle = hugeIcon('Alert02');
export const ArrowRight = hugeIcon('ArrowRight02');
export const ArrowUp = hugeIcon('ArrowUp02');
export const ArrowUpRight = hugeIcon('ArrowUpRight01');
export const Bell01 = hugeIcon('Notification01');
export const Check = hugeIcon('Tick02');
export const CheckCircle = hugeIcon('CheckmarkCircle02');
export const ChevronLeft = hugeIcon('ArrowLeft01');
export const ChevronRight = hugeIcon('ArrowRight01');
export const DotsVertical = hugeIcon('MoreVertical');
export const Download01 = hugeIcon('Download04');
export const Edit03 = hugeIcon('PencilEdit02');
export const Expand01 = hugeIcon('ArrowExpand01');
export const Eye = hugeIcon('View');
export const EyeOff = hugeIcon('ViewOff');
export const File06 = hugeIcon('File02');
export const InfoCircle = hugeIcon('InformationCircle');
export const Lightbulb02 = hugeIcon('Idea01');
export const Lock01 = hugeIcon('SquareLock02');
export const LogIn01 = hugeIcon('Login01');
export const Mail01 = hugeIcon('Mail01');
export const Minus = hugeIcon('MinusSign');
export const Plus = hugeIcon('Add01');
export const RefreshCw01 = hugeIcon('Refresh');
export const Send01 = hugeIcon('Sent');
export const Stars02 = hugeIcon('Sparkles');
export const UploadCloud02 = hugeIcon('CloudUpload');
export const XClose = hugeIcon('Cancel01');
export const Bookmark = hugeIcon('Bookmark02');
export const Briefcase01 = hugeIcon('Briefcase01');
export const Building07 = hugeIcon('Building06');
export const Calendar = hugeIcon('Calendar03');
export const Link01 = hugeIcon('Link01');
export const LinkExternal01 = hugeIcon('LinkSquare02');
export const ShieldTick = hugeIcon('SecurityCheck');
export const SwitchVertical01 = hugeIcon('ArrowDataTransferVertical');
export const User01 = hugeIcon('User');
export const Upload01 = hugeIcon('Upload04');
export const Clipboard = hugeIcon('Clipboard');
export const Folder = hugeIcon('Folder01');
export const Target04 = hugeIcon('Target02');
export const Zap = hugeIcon('Flash');
export const Code02 = hugeIcon('SourceCode');
export const Cube01 = hugeIcon('Cube');
export const DotsHorizontal = hugeIcon('MoreHorizontal');
export const Edit05 = hugeIcon('PencilEdit01');
export const Grid01 = hugeIcon('GridView');
export const LayersThree01 = hugeIcon('Layers01');
export const Menu01 = hugeIcon('Menu01');
export const SearchLg = hugeIcon('Search01');
export const Users01 = hugeIcon('UserGroup');
export const MinusCircle = hugeIcon('MinusSignCircle');
export const PauseCircle = hugeIcon('PauseCircle');
export const PlayCircle = hugeIcon('PlayCircle');
export const Settings01 = hugeIcon('Settings01');

/** The two icon sizes of the flows: 16px beside body text, 20px on its own. */
export const iconSize = { sm: 'size-4 shrink-0', md: 'size-5 shrink-0' } as const;
