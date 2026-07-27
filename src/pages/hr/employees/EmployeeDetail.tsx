import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, UserCheck, UserX, Mail, Phone, Calendar, Building, BadgeInfo, Briefcase, MapPin, Heart, Edit3, Trash2 } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { statusColor, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';

interface Employee {
  id: string; name: string; email: string; department: string; designation: string; status: string; joinDate: string; phone: string;
  address: string; emergencyName: string; emergencyPhone: string; emergencyRelation: string; dateOfBirth: string; gender: string; nationality: string;
}

const MOCK_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', department: 'Engineering', designation: 'Senior Developer', status: 'active', joinDate: '2023-01-15', phone: '+234 801 234 5678', address: '12, Awolowo Road, Ikoyi, Lagos', emergencyName: 'Bob Johnson', emergencyPhone: '+234 809 111 2222', emergencyRelation: 'Spouse', dateOfBirth: '1990-05-12', gender: 'Female', nationality: 'Nigerian' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', department: 'Marketing', designation: 'Marketing Lead', status: 'active', joinDate: '2022-06-01', phone: '+234 802 345 6789', address: '45, Bourdillon Road, Ikoyi, Lagos', emergencyName: 'Jane Smith', emergencyPhone: '+234 809 333 4444', emergencyRelation: 'Spouse', dateOfBirth: '1988-11-23', gender: 'Male', nationality: 'Nigerian' },
  { id: '3', name: 'Carol Williams', email: 'carol@example.com', department: 'Finance', designation: 'Accountant', status: 'active', joinDate: '2024-03-10', phone: '+234 803 456 7890', address: '8, Adeniyi Jones, Ikeja, Lagos', emergencyName: 'David Williams', emergencyPhone: '+234 809 555 6666', emergencyRelation: 'Brother', dateOfBirth: '1995-08-03', gender: 'Female', nationality: 'Nigerian' },
  { id: '4', name: 'David Brown', email: 'david@example.com', department: 'Engineering', designation: 'Junior Developer', status: 'inactive', joinDate: '2023-09-20', phone: '+234 804 567 8901', address: '22, Toyin Street, Ikeja, Lagos', emergencyName: 'Sarah Brown', emergencyPhone: '+234 809 777 8888', emergencyRelation: 'Mother', dateOfBirth: '1998-02-17', gender: 'Male', nationality: 'Nigerian' },
  { id: '5', name: 'Eve Davis', email: 'eve@example.com', department: 'HR', designation: 'HR Manager', status: 'active', joinDate: '2021-11-01', phone: '+234 805 678 9012', address: '7, Raymond Njoku, Ikoyi, Lagos', emergencyName: 'Frank Davis', emergencyPhone: '+234 809 999 0000', emergencyRelation: 'Spouse', dateOfBirth: '1987-07-29', gender: 'Female', nationality: 'Nigerian' },
  { id: '6', name: 'Frank Miller', email: 'frank@example.com', department: 'Sales', designation: 'Sales Rep', status: 'active', joinDate: '2024-07-15', phone: '+234 806 789 0123', address: '15, Allen Avenue, Ikeja, Lagos', emergencyName: 'Grace Miller', emergencyPhone: '+234 808 111 2222', emergencyRelation: 'Spouse', dateOfBirth: '1992-04-10', gender: 'Male', nationality: 'Nigerian' },
  { id: '7', name: 'Grace Wilson', email: 'grace@example.com', department: 'Marketing', designation: 'Content Writer', status: 'inactive', joinDate: '2023-04-05', phone: '+234 807 890 1234', address: '30, Norman Williams, Ikoyi, Lagos', emergencyName: 'Henry Wilson', emergencyPhone: '+234 808 333 4444', emergencyRelation: 'Father', dateOfBirth: '1996-09-14', gender: 'Female', nationality: 'Nigerian' },
  { id: '8', name: 'Henry Taylor', email: 'henry@example.com', department: 'Engineering', designation: 'DevOps Engineer', status: 'active', joinDate: '2025-01-10', phone: '+234 808 901 2345', address: '9, Opebi Road, Ikeja, Lagos', emergencyName: 'Irene Taylor', emergencyPhone: '+234 808 555 6666', emergencyRelation: 'Spouse', dateOfBirth: '1991-12-01', gender: 'Male', nationality: 'Nigerian' },
];

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-2xl border border-border-custom">
      <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-ink-900 mt-0.5 break-words">{value || '-'}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useToast();

  const employee = MOCK_EMPLOYEES.find(e => e.id === id);

  const stats = useMemo(() => [
    { label: 'Status', value: employee?.status === 'active' ? 'Active' : 'Inactive', icon: employee?.status === 'active' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />, color: employee?.status === 'active' ? 'emerald' as const : 'rose' as const },
    { label: 'Department', value: employee?.department || '-', icon: <Building className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Designation', value: employee?.designation || '-', icon: <BadgeInfo className="w-4 h-4" />, color: 'purple' as const },
    { label: 'Tenure', value: employee ? `${Math.floor((Date.now() - new Date(employee.joinDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} yrs` : '-', icon: <Calendar className="w-4 h-4" />, color: 'cyan' as const },
  ], [employee]);

  if (!employee) {
    return (
      <HrPageShell title="Employee Not Found" description="The employee you are looking for does not exist."
      pageKey="employees">
        <div className="flex flex-col items-center justify-center py-16 text-ink-400 gap-3">
          <p className="text-sm font-medium text-ink-600">Employee not found</p>
          <button onClick={() => navigate('/app/hr/employees')} className="text-xs font-medium text-primary hover:text-primary-hover">Back to Employees</button>
        </div>
      </HrPageShell>
    );
  }

  return (
    <HrPageShell title={employee.name} description={`Employee ID: ${employee.id} Â· ${employee.department}`}
      headerActions={
        <>
          <button onClick={() => navigate('/app/hr/employees')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
          <button onClick={() => navigate(`/app/hr/employees/edit/${employee.id}`)} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Personal Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard icon={<Users className="w-4 h-4" />} label="Full Name" value={employee.name} />
            <InfoCard icon={<Calendar className="w-4 h-4" />} label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
            <InfoCard icon={<BadgeInfo className="w-4 h-4" />} label="Gender" value={employee.gender} />
            <InfoCard icon={<MapPin className="w-4 h-4" />} label="Nationality" value={employee.nationality} />
          </div>
        </SectionCard>

        <SectionCard title="Employment Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard icon={<Building className="w-4 h-4" />} label="Department" value={employee.department} />
            <InfoCard icon={<Briefcase className="w-4 h-4" />} label="Designation" value={employee.designation} />
            <InfoCard icon={<Calendar className="w-4 h-4" />} label="Join Date" value={formatDate(employee.joinDate)} />
            <InfoCard icon={<UserCheck className="w-4 h-4" />} label="Status" value={employee.status} />
          </div>
        </SectionCard>

        <SectionCard title="Contact Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard icon={<Mail className="w-4 h-4" />} label="Email" value={employee.email} />
            <InfoCard icon={<Phone className="w-4 h-4" />} label="Phone" value={employee.phone} />
            <div className="sm:col-span-2">
              <InfoCard icon={<MapPin className="w-4 h-4" />} label="Address" value={employee.address} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Emergency Contact">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard icon={<Heart className="w-4 h-4" />} label="Contact Name" value={employee.emergencyName} />
            <InfoCard icon={<Phone className="w-4 h-4" />} label="Phone" value={employee.emergencyPhone} />
            <InfoCard icon={<Users className="w-4 h-4" />} label="Relation" value={employee.emergencyRelation} />
          </div>
        </SectionCard>
      </div>
    </HrPageShell>
  );
}


