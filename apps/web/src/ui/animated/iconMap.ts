import type { ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from 'react';
import type { Animation } from 'react-useanimations';
import alertTriangle from 'react-useanimations/lib/alertTriangle';
import bookOpen from 'react-useanimations/lib/bookOpen';
import briefcase from 'react-useanimations/lib/briefcase';
import code from 'react-useanimations/lib/code';
import database from 'react-useanimations/lib/database';
import fileMinus from 'react-useanimations/lib/fileMinus';
import filter from 'react-useanimations/lib/filter';
import flag from 'react-useanimations/lib/flag';
import info from 'react-useanimations/lib/info';
import moreVertical from 'react-useanimations/lib/moreVertical';
import repeat from 'react-useanimations/lib/repeat';
import tag from 'react-useanimations/lib/tag';
import userX from 'react-useanimations/lib/userX';

import { ActivityIcon } from './lucide/activity';
import { ArchiveIcon } from './lucide/archive';
import { ArrowDownIcon } from './lucide/arrow-down';
import { ArrowRightIcon } from './lucide/arrow-right';
import { ArrowUpIcon } from './lucide/arrow-up';
import { ArrowUpRightIcon } from './lucide/arrow-up-right';
import { BadgePercentIcon } from './lucide/badge-percent';
import { BellIcon } from './lucide/bell';
import { BookmarkIcon } from './lucide/bookmark';
import { CalendarDaysIcon } from './lucide/calendar-days';
import { ChartColumnIncreasingIcon } from './lucide/chart-column-increasing';
import { ChartPieIcon } from './lucide/chart-pie';
import { CheckIcon } from './lucide/check';
import { ChevronDownIcon } from './lucide/chevron-down';
import { ChevronRightIcon } from './lucide/chevron-right';
import { ChevronsUpDownIcon } from './lucide/chevrons-up-down';
import { CircleCheckIcon } from './lucide/circle-check';
import { CircleHelpIcon } from './lucide/circle-help';
import { ClipboardCheckIcon } from './lucide/clipboard-check';
import { ClockIcon } from './lucide/clock';
import { CloudUploadIcon } from './lucide/cloud-upload';
import { CopyIcon } from './lucide/copy';
import { CreditCardIcon } from './lucide/credit-card';
import { DeleteIcon } from './lucide/delete';
import { DollarSignIcon } from './lucide/dollar-sign';
import { DownloadIcon } from './lucide/download';
import { EarthIcon } from './lucide/earth';
import { EyeIcon } from './lucide/eye';
import { FileCheckIcon } from './lucide/file-check';
import { FileTextIcon } from './lucide/file-text';
import { GaugeIcon } from './lucide/gauge';
import { GitBranchIcon } from './lucide/git-branch';
import { GitCompareArrowsIcon } from './lucide/git-compare-arrows';
import { HandCoinsIcon } from './lucide/hand-coins';
import { HomeIcon } from './lucide/home';
import { HourglassIcon } from './lucide/hourglass';
import { KeyIcon } from './lucide/key';
import { LayoutGridIcon } from './lucide/layout-grid';
import { LayoutPanelTopIcon } from './lucide/layout-panel-top';
import { LinkIcon } from './lucide/link';
import { LockIcon } from './lucide/lock';
import { LogoutIcon } from './lucide/logout';
import { MailCheckIcon } from './lucide/mail-check';
import { MenuIcon } from './lucide/menu';
import { MicIcon } from './lucide/mic';
import { MonitorCheckIcon } from './lucide/monitor-check';
import { PlayIcon } from './lucide/play';
import { PlusIcon } from './lucide/plus';
import { RefreshCWIcon } from './lucide/refresh-cw';
import { SearchIcon } from './lucide/search';
import { SendIcon } from './lucide/send';
import { ServerIcon } from './lucide/server';
import { SettingsIcon } from './lucide/settings';
import { ShieldCheckIcon } from './lucide/shield-check';
import { SparklesIcon } from './lucide/sparkles';
import { SquarePenIcon } from './lucide/square-pen';
import { TerminalIcon } from './lucide/terminal';
import { TrendingUpIcon } from './lucide/trending-up';
import { UndoIcon } from './lucide/undo';
import { UserPlusIcon } from './lucide/user-plus';
import { UsersIcon } from './lucide/users';
import { UsersRoundIcon } from './lucide/users-round';
import { XIcon } from './lucide/x';
import { ZapIcon } from './lucide/zap';

/** What every vendored lucide-animated icon exposes through its ref. */
export type LucideHandle = { startAnimation: () => void; stopAnimation: () => void };

export type LucideIcon = ForwardRefExoticComponent<
  HTMLAttributes<HTMLSpanElement> & { size?: number } & RefAttributes<LucideHandle>
>;

export type IconSource =
  { kind: 'lucide'; Icon: LucideIcon } | { kind: 'useanimations'; animation: Animation };

const lucide = (Icon: LucideIcon): IconSource => ({ kind: 'lucide', Icon });
const ua = (animation: Animation): IconSource => ({ kind: 'useanimations', animation });

/**
 * The admin boards' icons (the "Admin icons (components)" frame, Figma 382:937), keyed by the
 * name the board gives each one, and where its animated version comes from.
 *
 * The boards draw Untitled UI line icons. The owner asked for animated ones (2026-11-05), so each
 * board icon maps to its nearest animated equivalent: lucide-animated first, react-useanimations
 * where lucide-animated has no match. animate-ui was the third source offered, but every gap
 * lucide-animated leaves is either filled by react-useanimations or missing from animate-ui too,
 * so it isn't used. The substitutions are listed in `toreview.md` §171.
 */
export const ADMIN_ICONS = {
  Activity: lucide(ActivityIcon),
  AlertTriangle: ua(alertTriangle),
  Archive: lucide(ArchiveIcon),
  ArrowDown: lucide(ArrowDownIcon),
  ArrowRight: lucide(ArrowRightIcon),
  ArrowUp: lucide(ArrowUpIcon),
  ArrowUpRight: lucide(ArrowUpRightIcon),
  BarChart10: lucide(ChartColumnIncreasingIcon),
  Bell01: lucide(BellIcon),
  BookOpen01: ua(bookOpen),
  Bookmark: lucide(BookmarkIcon),
  Building07: ua(briefcase),
  Calendar: lucide(CalendarDaysIcon),
  Check: lucide(CheckIcon),
  CheckCircle: lucide(CircleCheckIcon),
  ChevronDown: lucide(ChevronDownIcon),
  ChevronRight: lucide(ChevronRightIcon),
  ChevronSelectorVertical: lucide(ChevronsUpDownIcon),
  ClipboardCheck: lucide(ClipboardCheckIcon),
  Clock: lucide(ClockIcon),
  Code02: ua(code),
  CoinsStacked01: lucide(HandCoinsIcon),
  Copy01: lucide(CopyIcon),
  CreditCard02: lucide(CreditCardIcon),
  CurrencyDollar: lucide(DollarSignIcon),
  Database01: ua(database),
  DotsVertical: ua(moreVertical),
  Download01: lucide(DownloadIcon),
  Edit03: lucide(SquarePenIcon),
  Eye: lucide(EyeIcon),
  File06: lucide(FileTextIcon),
  FileCheck02: lucide(FileCheckIcon),
  FileX02: ua(fileMinus),
  FilterLines: ua(filter),
  Flag01: ua(flag),
  FlipBackward: lucide(UndoIcon),
  GitBranch01: lucide(GitBranchIcon),
  Globe01: lucide(EarthIcon),
  Grid01: lucide(LayoutGridIcon),
  HelpCircle: lucide(CircleHelpIcon),
  HomeLine: lucide(HomeIcon),
  Hourglass01: lucide(HourglassIcon),
  InfoCircle: ua(info),
  Key01: lucide(KeyIcon),
  LayoutAlt01: lucide(LayoutPanelTopIcon),
  Link01: lucide(LinkIcon),
  Lock01: lucide(LockIcon),
  LogOut01: lucide(LogoutIcon),
  Mail01: lucide(MailCheckIcon),
  Menu01: lucide(MenuIcon),
  Microphone01: lucide(MicIcon),
  Monitor01: lucide(MonitorCheckIcon),
  Percent02: lucide(BadgePercentIcon),
  PieChart03: lucide(ChartPieIcon),
  Play: lucide(PlayIcon),
  Plus: lucide(PlusIcon),
  RefreshCw01: lucide(RefreshCWIcon),
  Repeat01: ua(repeat),
  Scale02: lucide(GaugeIcon),
  SearchLg: lucide(SearchIcon),
  Send01: lucide(SendIcon),
  Server01: lucide(ServerIcon),
  Settings01: lucide(SettingsIcon),
  ShieldTick: lucide(ShieldCheckIcon),
  Stars02: lucide(SparklesIcon),
  SwitchHorizontal01: lucide(GitCompareArrowsIcon),
  Tag01: ua(tag),
  Terminal: lucide(TerminalIcon),
  Trash01: lucide(DeleteIcon),
  TrendUp01: lucide(TrendingUpIcon),
  UploadCloud02: lucide(CloudUploadIcon),
  UserPlus01: lucide(UserPlusIcon),
  UserX01: ua(userX),
  Users01: lucide(UsersIcon),
  Users02: lucide(UsersRoundIcon),
  XClose: lucide(XIcon),
  Zap: lucide(ZapIcon),
} as const satisfies Record<string, IconSource>;

export type AdminIconName = keyof typeof ADMIN_ICONS;
