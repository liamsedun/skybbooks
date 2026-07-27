// ── Layout ──────────────────────────────────────
export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

// ── Navigation ──────────────────────────────────
export { Tabs, TabsList, TabsTrigger, TabsContent, useTabsValue } from './Tabs';
export type { /* internal */ } from './Tabs';

export { Accordion, AccordionItem } from './Accordion';
export type { /* internal */ } from './Accordion';

// ── Data Display ────────────────────────────────
export { Table, useTableSort } from './Table';
export type { TableColumn } from './Table';

export { Pagination } from './Pagination';
export type { PaginationProps } from './Pagination';

export { Timeline, TimelineItem, TimelineTitle, TimelineText, TimelineTime } from './Timeline';
export { ActivityFeed, ActivityItem } from './ActivityFeed';

// ── Cards & Stats ───────────────────────────────
export { Card, CardHeader, CardContent, CardFooter, CardGrid } from './Card';
export type { CardProps, CardHeaderProps, CardContentProps, CardFooterProps, CardGridProps } from './Card';

export { StatCard, StatGrid } from './StatCard';
export type { StatCardProps } from './StatCard';

// ── Widgets & Charts ────────────────────────────
export { Widget, WidgetMenuButton } from './Widget';
export type { WidgetProps } from './Widget';

// ── Search & Filters ────────────────────────────
export { SearchBar } from './SearchBar';
export type { SearchBarProps } from './SearchBar';

export { FilterPanel, FilterSelect, FilterDateRange } from './FilterPanel';
export type { FilterPanelProps, FilterSelectProps, FilterDateRangeProps } from './FilterPanel';

// ── Status & Feedback ───────────────────────────
export { StatusBadge, getStatusColor, StatusDot } from './StatusBadge';
export type { StatusBadgeProps } from './StatusBadge';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { ErrorDisplay, SuccessMessage } from './ErrorDisplay';
export type { ErrorDisplayProps, /* SuccessMessageProps */ } from './ErrorDisplay';

// ── Loading ─────────────────────────────────────
export { Skeleton, TableSkeleton, CardSkeleton, FormSkeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

// ── Modals & Overlays ───────────────────────────
export { Modal, FormModal, Drawer, ConfirmDialog } from './Modal';
export type { ModalProps, FormModalProps, DrawerProps, ConfirmDialogProps } from './Modal';

// ── Approval Workflow ───────────────────────────
export { ApprovalPanel, ApprovalActions, ApproverAvatar } from './ApprovalPanel';
export type { ApprovalPanelProps, ApprovalActionProps, ApproverAvatarProps } from './ApprovalPanel';
