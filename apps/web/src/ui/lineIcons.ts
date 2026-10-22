/**
 * The line icons of the resume flows (toreview §131): Untitled UI's own set, the library the owner
 * pointed to, from its free MIT package. One file names every one in use, so the flows draw from
 * one family: one check, one kebab, one sparkle. Size them with `iconSize`; they stroke in
 * `currentColor`.
 *
 * Deep imports keep each icon its own module, so a page bundles only the ones it draws.
 */
export { AlertCircle } from '@untitledui/icons/AlertCircle';
export { AlertTriangle } from '@untitledui/icons/AlertTriangle';
export { ArrowRight } from '@untitledui/icons/ArrowRight';
export { ArrowUp } from '@untitledui/icons/ArrowUp';
export { Bell01 } from '@untitledui/icons/Bell01';
export { Check } from '@untitledui/icons/Check';
export { CheckCircle } from '@untitledui/icons/CheckCircle';
export { ChevronLeft } from '@untitledui/icons/ChevronLeft';
export { ChevronRight } from '@untitledui/icons/ChevronRight';
export { DotsVertical } from '@untitledui/icons/DotsVertical';
export { Download01 } from '@untitledui/icons/Download01';
export { Edit03 } from '@untitledui/icons/Edit03';
export { Expand01 } from '@untitledui/icons/Expand01';
export { File06 } from '@untitledui/icons/File06';
export { InfoCircle } from '@untitledui/icons/InfoCircle';
export { Lightbulb02 } from '@untitledui/icons/Lightbulb02';
export { Mail01 } from '@untitledui/icons/Mail01';
export { Minus } from '@untitledui/icons/Minus';
export { Plus } from '@untitledui/icons/Plus';
export { RefreshCw01 } from '@untitledui/icons/RefreshCw01';
export { Send01 } from '@untitledui/icons/Send01';
export { Stars02 } from '@untitledui/icons/Stars02';
export { UploadCloud02 } from '@untitledui/icons/UploadCloud02';
export { XClose } from '@untitledui/icons/XClose';

/** The two icon sizes of the flows: 16px beside body text, 20px on its own. */
export const iconSize = { sm: 'size-4 shrink-0', md: 'size-5 shrink-0' } as const;
