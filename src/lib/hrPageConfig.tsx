import { ReactNode } from 'react';
import { Users, CalendarCheck, ClipboardList, Target, Megaphone, Briefcase, GraduationCap, Heart, BookOpen, FileText, Luggage, CheckSquare, GitBranch, UserMinus, DollarSign, Clock, Headphones, Award, Shield, Building, BarChart3, Star, ClipboardCheck, ArrowUpCircle } from 'lucide-react';

export interface RelatedModule {
  label: string;
  path: string;
  icon: ReactNode;
}

export interface HrPageConfig {
  helpContent: string;
  relatedModules: RelatedModule[];
}

const configs: Record<string, HrPageConfig> = {
  'home': {
    helpContent: 'The HR Home dashboard provides a calendar view of all upcoming HR events including birthdays, holidays, meetings, and training sessions. Use it to stay informed about important dates. Switch months using the navigation arrows and click any event for details. Events are colour-coded by type — pink for birthdays, purple for holidays, blue for meetings, and green for training.',
    relatedModules: [
      { label: 'Announcements', path: '/app/hr/announcements', icon: <Megaphone className="w-4 h-4" /> },
      { label: 'Leave Requests', path: '/app/hr/leave/requests', icon: <CalendarCheck className="w-4 h-4" /> },
      { label: 'All Employees', path: '/app/hr/employees/list', icon: <Users className="w-4 h-4" /> },
    ],
  },
  'announcements': {
    helpContent: 'Use this page to create and manage company-wide announcements. Choose from three priority levels — High (urgent), Medium (important), or Low (informational). Announcements can be saved as drafts and published later. Published announcements are visible to all employees on their dashboard.',
    relatedModules: [
      { label: 'HR Calendar', path: '/app/hr/home', icon: <CalendarCheck className="w-4 h-4" /> },
      { label: 'Surveys', path: '/app/hr/surveys', icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Recognition', path: '/app/hr/recognition', icon: <Award className="w-4 h-4" /> },
    ],
  },
  'surveys': {
    helpContent: 'Create and distribute employee surveys to gather feedback on engagement, satisfaction, training needs, and more. Set a target number of responses and track completion rates in real time. Surveys can be saved as drafts, activated, or marked complete once sufficient responses are collected.',
    relatedModules: [
      { label: 'Announcements', path: '/app/hr/announcements', icon: <Megaphone className="w-4 h-4" /> },
      { label: 'Recognition', path: '/app/hr/recognition', icon: <Award className="w-4 h-4" /> },
      { label: 'Help Desk', path: '/app/hr/helpdesk', icon: <Headphones className="w-4 h-4" /> },
    ],
  },
  'goals': {
    helpContent: 'Define and track Objectives and Key Results (OKRs) for the organisation. Each goal has measurable key results, a progress percentage, and an owner. Use the status filter to view active, completed, or draft goals. The progress bar colour indicates health — green for on track, amber for at risk, and red for behind schedule.',
    relatedModules: [
      { label: 'Performance Reviews', path: '/app/hr/performance/reviews', icon: <Star className="w-4 h-4" /> },
      { label: 'Tasks', path: '/app/hr/tasks', icon: <CheckSquare className="w-4 h-4" /> },
      { label: 'Projects', path: '/app/hr/projects', icon: <Briefcase className="w-4 h-4" /> },
    ],
  },
  'candidates': {
    helpContent: 'Manage job applicants through the recruitment pipeline. Track each candidate\'s status from New → Screening → Interview → Offer → Hired or Rejected. Use the import feature to bulk-upload candidates from a CSV file. Click the Add Candidate button to create a new record, or use the dedicated form for more detailed entries.',
    relatedModules: [
      { label: 'Job Openings', path: '/app/hr/recruitment/jobs', icon: <Briefcase className="w-4 h-4" /> },
      { label: 'Employees', path: '/app/hr/employees/list', icon: <Users className="w-4 h-4" /> },
      { label: 'Onboarding', path: '/app/hr/recruitment/onboarding', icon: <GraduationCap className="w-4 h-4" /> },
    ],
  },
  'jobs': {
    helpContent: 'Post and manage job openings for your organisation. Each listing includes the position title, department, location, job type (full-time, part-time, contract), and the number of open positions. Open listings accept applications, while closed ones are no longer accepting new applicants.',
    relatedModules: [
      { label: 'Candidates', path: '/app/hr/recruitment/candidates', icon: <Users className="w-4 h-4" /> },
      { label: 'Applications', path: '/app/hr/recruitment/candidates', icon: <FileText className="w-4 h-4" /> },
      { label: 'Departments', path: '/app/hr/employees/departments', icon: <Building className="w-4 h-4" /> },
    ],
  },
  'employees': {
    helpContent: 'Maintain your organisation\'s employee directory. Each record captures personal details, contact information, department assignment, job designation, and employment status. Use the search bar to find employees quickly, and click on a row to view the full profile. The bulk import feature lets you add employees from a CSV file.',
    relatedModules: [
      { label: 'Departments', path: '/app/hr/employees/departments', icon: <Building className="w-4 h-4" /> },
      { label: 'Designations', path: '/app/hr/employees/designations', icon: <Shield className="w-4 h-4" /> },
      { label: 'Users', path: '/app/hr/manage/users', icon: <Users className="w-4 h-4" /> },
    ],
  },
  'departments': {
    helpContent: 'Organise your company structure by defining departments. Each department has a name, description, manager, and headcount. Use departments to group employees and filter reports. This structure cascades to leave approvals, expense routing, and organisational reporting.',
    relatedModules: [
      { label: 'Employees', path: '/app/hr/employees/list', icon: <Users className="w-4 h-4" /> },
      { label: 'Designations', path: '/app/hr/employees/designations', icon: <Shield className="w-4 h-4" /> },
      { label: 'Org Chart', path: '/app/hr/manage/organisation', icon: <Building className="w-4 h-4" /> },
    ],
  },
  'leave-requests': {
    helpContent: 'Process incoming leave requests from employees. Each request shows the leave type, duration, and reason. Approve or reject pending requests directly from the actions column. The status filter helps you focus on pending requests that need your attention. Leave types include Annual, Sick, Maternity, Paternity, and Compassionate.',
    relatedModules: [
      { label: 'Leave Summary', path: '/app/hr/leave/summary', icon: <BarChart3 className="w-4 h-4" /> },
      { label: 'Leave Types', path: '/app/hr/leave/types', icon: <CalendarCheck className="w-4 h-4" /> },
      { label: 'Attendance', path: '/app/hr/attendance', icon: <Clock className="w-4 h-4" /> },
    ],
  },
  'attendance': {
    helpContent: 'Track daily employee attendance including clock-in/out times and total hours worked. Records are colour-coded: green for present, red for absent, amber for late arrivals, and purple for half-days. Use this data for payroll calculation and to identify attendance patterns across the organisation.',
    relatedModules: [
      { label: 'Leave Requests', path: '/app/hr/leave/requests', icon: <CalendarCheck className="w-4 h-4" /> },
      { label: 'Time Tracker', path: '/app/hr/time/timesheets', icon: <Clock className="w-4 h-4" /> },
      { label: 'Shifts', path: '/app/hr/attendance/shifts', icon: <CalendarCheck className="w-4 h-4" /> },
    ],
  },
  'shifts': {
    helpContent: 'Define and manage work shifts for employees. Each shift has a name, time window (start/end), and assigned employees. Shifts are used in attendance tracking to determine expected clock-in/out times and to calculate late arrivals or early departures.',
    relatedModules: [
      { label: 'Attendance', path: '/app/hr/attendance', icon: <Clock className="w-4 h-4" /> },
      { label: 'Time Tracker', path: '/app/hr/time/timesheets', icon: <CalendarCheck className="w-4 h-4" /> },
      { label: 'Employees', path: '/app/hr/employees/list', icon: <Users className="w-4 h-4" /> },
    ],
  },
  'timesheets': {
    helpContent: 'Review and manage employee timesheets. Each timesheet covers a weekly period with total hours logged. Track the approval status — pending, approved, or rejected. Approve or reject timesheets directly from the list. Timesheets feed into payroll processing and project costing.',
    relatedModules: [
      { label: 'Time Logs', path: '/app/hr/time/logs', icon: <Clock className="w-4 h-4" /> },
      { label: 'Attendance', path: '/app/hr/attendance', icon: <CalendarCheck className="w-4 h-4" /> },
      { label: 'Payroll', path: '/app/payroll', icon: <DollarSign className="w-4 h-4" /> },
    ],
  },
  'time-logs': {
    helpContent: 'View detailed time entries logged by employees. Each entry captures the date, project or task, hours worked, and a description. Use the date range filter to narrow down to specific periods. Time logs are aggregated into timesheets for weekly approval and payroll processing.',
    relatedModules: [
      { label: 'Timesheets', path: '/app/hr/time/timesheets', icon: <FileText className="w-4 h-4" /> },
      { label: 'Tasks', path: '/app/hr/tasks', icon: <CheckSquare className="w-4 h-4" /> },
      { label: 'Projects', path: '/app/hr/projects', icon: <Briefcase className="w-4 h-4" /> },
    ],
  },
  'performance-reviews': {
    helpContent: 'Manage the performance review cycle for all employees. Reviews are assigned a reviewer and a review period. Track completion status — Pending, In Progress, or Completed. Ratings are displayed on a 5.0 scale. Use these evaluations to inform promotions, bonuses, and development plans.',
    relatedModules: [
      { label: 'OKR Goals', path: '/app/hr/goals', icon: <Target className="w-4 h-4" /> },
      { label: 'Recognition', path: '/app/hr/recognition', icon: <Award className="w-4 h-4" /> },
      { label: 'Courses', path: '/app/hr/courses', icon: <BookOpen className="w-4 h-4" /> },
    ],
  },
  'helpdesk': {
    helpContent: 'The HR Help Desk manages employee inquiries and support tickets. Tickets are categorised by type (Technical, Payroll, Leave, HR, Benefits, IT, Finance, Performance) and prioritised from Low to Urgent. Track resolution through the status workflow: Open → In Progress → Resolved → Closed.',
    relatedModules: [
      { label: 'Announcements', path: '/app/hr/announcements', icon: <Megaphone className="w-4 h-4" /> },
      { label: 'Surveys', path: '/app/hr/surveys', icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Policies', path: '/app/hr/administration/policies', icon: <FileText className="w-4 h-4" /> },
    ],
  },
  'recognition': {
    helpContent: 'Celebrate employee achievements by sending recognition awards. Choose from recognition types like Excellence, Innovation, Teamwork, Leadership, and Customer Focus. Peer-to-peer recognition fosters a positive workplace culture. Recognitions are visible to the entire organisation on the HR home page.',
    relatedModules: [
      { label: 'Announcements', path: '/app/hr/announcements', icon: <Megaphone className="w-4 h-4" /> },
      { label: 'Performance Reviews', path: '/app/hr/performance/reviews', icon: <ClipboardCheck className="w-4 h-4" /> },
      { label: 'Surveys', path: '/app/hr/surveys', icon: <ClipboardList className="w-4 h-4" /> },
    ],
  },
  'courses': {
    helpContent: 'Manage the course and training catalogue for employee development. Each course has a title, category, duration, and enrolment capacity. Track which courses are active, upcoming, or completed. Assign courses to employees and monitor completion rates for compliance and skill development tracking.',
    relatedModules: [
      { label: 'Performance Reviews', path: '/app/hr/performance/reviews', icon: <ClipboardCheck className="w-4 h-4" /> },
      { label: 'Goals', path: '/app/hr/goals', icon: <Target className="w-4 h-4" /> },
      { label: 'Onboarding', path: '/app/hr/recruitment/onboarding', icon: <GraduationCap className="w-4 h-4" /> },
    ],
  },
  'letters': {
    helpContent: 'Generate and manage official HR letters including offer letters, experience certificates, bonafide certificates, address proofs, and warning letters. Each letter type has a standard template that you can customise. Use the templates page to create and edit letter templates before issuing them to employees.',
    relatedModules: [
      { label: 'Templates', path: '/app/hr/letters/templates', icon: <FileText className="w-4 h-4" /> },
      { label: 'Employees', path: '/app/hr/employees/list', icon: <Users className="w-4 h-4" /> },
      { label: 'Offboarding', path: '/app/hr/offboarding', icon: <UserMinus className="w-4 h-4" /> },
    ],
  },
  'travel': {
    helpContent: 'Manage travel requests from employees. Each request includes destination, travel dates, purpose, and estimated cost. Track approval status through the workflow. Approved travel requests can be converted to travel expenses for reimbursement processing.',
    relatedModules: [
      { label: 'Expenses', path: '/app/hr/expenses', icon: <DollarSign className="w-4 h-4" /> },
      { label: 'Approvals', path: '/app/hr/approvals', icon: <CheckSquare className="w-4 h-4" /> },
      { label: 'Leave Requests', path: '/app/hr/leave/requests', icon: <CalendarCheck className="w-4 h-4" /> },
    ],
  },
  'expenses': {
    helpContent: 'Track and manage employee expense reports. Expenses can be categorised as Travel, Office Supplies, Equipment, Meals, Transportation, or Other. Each report tracks the amount claimed versus the amount approved. Submit reports for approval and track reimbursement status.',
    relatedModules: [
      { label: 'Travel Requests', path: '/app/hr/travel', icon: <Luggage className="w-4 h-4" /> },
      { label: 'Approvals', path: '/app/hr/approvals', icon: <CheckSquare className="w-4 h-4" /> },
      { label: 'Policies', path: '/app/hr/administration/policies', icon: <FileText className="w-4 h-4" /> },
    ],
  },
  'tasks': {
    helpContent: 'Assign and track HR-related tasks across the team. Each task has an assignee, due date, priority level, and status. Use the status filter to focus on pending or completed tasks. Tasks can be linked to larger projects for better progress tracking across initiatives.',
    relatedModules: [
      { label: 'Projects', path: '/app/hr/projects', icon: <Briefcase className="w-4 h-4" /> },
      { label: 'Goals', path: '/app/hr/goals', icon: <Target className="w-4 h-4" /> },
      { label: 'Workflows', path: '/app/hr/workflows', icon: <GitBranch className="w-4 h-4" /> },
    ],
  },
  'offboarding': {
    helpContent: 'Manage the employee offboarding process. Each offboarding record tracks the departing employee, last working day, reason for departure, and exit status (initiated, in progress, or completed). The checklist ensures all exit formalities are completed — asset return, final settlement, and experience letter.',
    relatedModules: [
      { label: 'Letters', path: '/app/hr/letters', icon: <FileText className="w-4 h-4" /> },
      { label: 'Employees', path: '/app/hr/employees/list', icon: <Users className="w-4 h-4" /> },
      { label: 'Approvals', path: '/app/hr/approvals', icon: <CheckSquare className="w-4 h-4" /> },
    ],
  },
  'compensation': {
    helpContent: 'Manage employee compensation structures including salary bands, pay grades, and benefits. Track compensation components such as base pay, allowances, bonuses, and deductions. Use this data alongside performance reviews to make informed compensation decisions.',
    relatedModules: [
      { label: 'Benefits', path: '/app/hr/compensation/benefits', icon: <Heart className="w-4 h-4" /> },
      { label: 'Performance Reviews', path: '/app/hr/performance/reviews', icon: <ClipboardCheck className="w-4 h-4" /> },
      { label: 'Payroll', path: '/app/payroll', icon: <DollarSign className="w-4 h-4" /> },
    ],
  },
  'benefits': {
    helpContent: 'Define and manage employee benefit programmes including health insurance, pension plans, transportation allowances, meal vouchers, and wellness programmes. Each benefit has a type, description, and associated cost. Benefits are assigned to employees during onboarding or during the annual enrolment period.',
    relatedModules: [
      { label: 'Compensation', path: '/app/hr/compensation', icon: <DollarSign className="w-4 h-4" /> },
      { label: 'Employees', path: '/app/hr/employees/list', icon: <Users className="w-4 h-4" /> },
      { label: 'Settings', path: '/app/hr/administration', icon: <Shield className="w-4 h-4" /> },
    ],
  },
  'approvals': {
    helpContent: 'Central hub for all pending HR approvals including leave requests, travel requests, expenses, and offboarding tasks. Quickly approve or reject items from the list. Use the type filter to focus on a specific approval category. Approvals can be configured via the Workflows module.',
    relatedModules: [
      { label: 'Workflows', path: '/app/hr/workflows', icon: <GitBranch className="w-4 h-4" /> },
      { label: 'Leave Requests', path: '/app/hr/leave/requests', icon: <CalendarCheck className="w-4 h-4" /> },
      { label: 'Travel Requests', path: '/app/hr/travel', icon: <Luggage className="w-4 h-4" /> },
    ],
  },
  'workflows': {
    helpContent: 'Design and manage approval workflows for HR processes. Each workflow defines the steps, approvers, and conditions for a specific process type such as leave, travel, or expenses. Workflows ensure consistent and auditable approval processes across the organisation.',
    relatedModules: [
      { label: 'Approvals', path: '/app/hr/approvals', icon: <CheckSquare className="w-4 h-4" /> },
      { label: 'Leave Types', path: '/app/hr/leave/types', icon: <CalendarCheck className="w-4 h-4" /> },
      { label: 'Policies', path: '/app/hr/administration/policies', icon: <FileText className="w-4 h-4" /> },
    ],
  },
  'projects': {
    helpContent: 'Track HR initiatives and projects from planning to completion. Each project has an owner, timeline, status, and priority. Projects can be broken down into tasks and assigned to team members. Use this module to manage organisation-wide HR transformation initiatives.',
    relatedModules: [
      { label: 'Tasks', path: '/app/hr/tasks', icon: <CheckSquare className="w-4 h-4" /> },
      { label: 'Goals', path: '/app/hr/goals', icon: <Target className="w-4 h-4" /> },
      { label: 'Reports', path: '/app/hr/reports', icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },
  'administration': {
    helpContent: 'Configure HR system settings and policies. Manage leave types, pay grades, document types, and system preferences. Policies define the rules and guidelines that govern HR processes. Changes made here affect how the HR module operates across the organisation.',
    relatedModules: [
      { label: 'Policies', path: '/app/hr/administration/policies', icon: <FileText className="w-4 h-4" /> },
      { label: 'Leave Types', path: '/app/hr/leave/types', icon: <CalendarCheck className="w-4 h-4" /> },
      { label: 'Settings', path: '/app/hr/administration/settings', icon: <Shield className="w-4 h-4" /> },
    ],
  },
  'policies': {
    helpContent: 'Create and manage HR policies that govern employee conduct, leave, expenses, and workplace behaviour. Each policy has a title, category, effective date, and status. Policies are version-controlled and must be acknowledged by employees upon update.',
    relatedModules: [
      { label: 'Administration', path: '/app/hr/administration', icon: <Shield className="w-4 h-4" /> },
      { label: 'Announcements', path: '/app/hr/announcements', icon: <Megaphone className="w-4 h-4" /> },
      { label: 'Help Desk', path: '/app/hr/helpdesk', icon: <Headphones className="w-4 h-4" /> },
    ],
  },
  'reports': {
    helpContent: 'Access HR analytics and reports across attendance, leave, performance, and employee demographics. Use the filters to narrow down by department, date range, or employee. Export reports to CSV or PDF for sharing with stakeholders. Reports inform strategic workforce planning.',
    relatedModules: [
      { label: 'Analytics', path: '/app/hr/reports/sub/analytics', icon: <BarChart3 className="w-4 h-4" /> },
      { label: 'Attendance', path: '/app/hr/reports/sub/attendance', icon: <Clock className="w-4 h-4" /> },
      { label: 'Leave Balance', path: '/app/hr/reports/sub/leave-balance', icon: <CalendarCheck className="w-4 h-4" /> },
    ],
  },
  'manage': {
    helpContent: 'Administer HR system users, roles, and organisation structure. Manage user accounts, assign roles and permissions, configure services, and maintain the organisational hierarchy. This hub provides centralised control over who can access what within the HR module.',
    relatedModules: [
      { label: 'Users', path: '/app/hr/manage/users', icon: <Users className="w-4 h-4" /> },
      { label: 'Organisation', path: '/app/hr/manage/organisation', icon: <Building className="w-4 h-4" /> },
      { label: 'Roles', path: '/app/hr/manage/roles', icon: <Shield className="w-4 h-4" /> },
    ],
  },
  'welcome': {
    helpContent: 'Welcome to SkyHRM — your central hub for human resource management. From here you can access all HR modules including employee management, leave tracking, attendance, recruitment, performance reviews, and more. Use the sidebar to navigate between sections or use the quick action buttons below.',
    relatedModules: [
      { label: 'Employees', path: '/app/hr/employees/list', icon: <Users className="w-4 h-4" /> },
      { label: 'Leave Requests', path: '/app/hr/leave/requests', icon: <CalendarCheck className="w-4 h-4" /> },
      { label: 'Attendance', path: '/app/hr/attendance', icon: <Clock className="w-4 h-4" /> },
    ],
  },
  'add-candidate': {
    helpContent: 'Fill in the candidate details to add a new applicant to the recruitment pipeline. All fields marked with required labels are mandatory. Once created, the candidate will appear in the Candidates list and can be progressed through the recruitment stages.',
    relatedModules: [
      { label: 'All Candidates', path: '/app/hr/recruitment/candidates', icon: <Users className="w-4 h-4" /> },
      { label: 'Job Openings', path: '/app/hr/recruitment/jobs', icon: <Briefcase className="w-4 h-4" /> },
    ],
  },
};

export function getPageConfig(pageKey: string): HrPageConfig | undefined {
  return configs[pageKey];
}
