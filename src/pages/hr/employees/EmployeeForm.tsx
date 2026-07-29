import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
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

function FormField({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink-500 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  );
}

export function EmployeeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: '', email: '', department: '', designation: '', status: 'active', joinDate: '', phone: '',
    address: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '', dateOfBirth: '', gender: '', nationality: 'Nigerian',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) {
      const emp = MOCK_EMPLOYEES.find(e => e.id === id);
      if (emp) {
        setFormData({
          name: emp.name, email: emp.email, department: emp.department, designation: emp.designation, status: emp.status,
          joinDate: emp.joinDate, phone: emp.phone, address: emp.address, emergencyName: emp.emergencyName,
          emergencyPhone: emp.emergencyPhone, emergencyRelation: emp.emergencyRelation, dateOfBirth: emp.dateOfBirth,
          gender: emp.gender, nationality: emp.nationality,
        });
      }
    }
  }, [id, isEdit]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const { [field]: _, ...rest } = prev; return rest; });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.department) newErrors.department = 'Department is required';
    if (!formData.designation.trim()) newErrors.designation = 'Designation is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast(isEdit ? 'Employee updated successfully' : 'Employee created successfully', 'success');
      navigate('/app/hr/employees');
    }, 500);
  };

  return (
<HrPageShell title={isEdit ? 'Edit Employee' : 'Add Employee'} description={isEdit ? 'Update employee information' : 'Register a new employee'} pageKey="employees"
      headerActions={
        <button onClick={() => navigate('/app/hr/employees')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
      }>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
            <h3 className="text-sm font-semibold text-ink-900">Personal Information</h3>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Full Name" id="name" error={errors.name}>
                <input id="name" value={formData.name} onChange={e => updateField('name', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="John Doe" />
              </FormField>
              <FormField label="Email" id="email" error={errors.email}>
                <input id="email" type="email" value={formData.email} onChange={e => updateField('email', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="john@example.com" />
              </FormField>
              <FormField label="Date of Birth" id="dateOfBirth">
                <input id="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={e => updateField('dateOfBirth', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </FormField>
              <FormField label="Gender" id="gender">
                <select id="gender" value={formData.gender} onChange={e => updateField('gender', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </FormField>
              <FormField label="Nationality" id="nationality">
                <input id="nationality" value={formData.nationality} onChange={e => updateField('nationality', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Nigerian" />
              </FormField>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
            <h3 className="text-sm font-semibold text-ink-900">Employment Information</h3>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Department" id="department" error={errors.department}>
                <select id="department" value={formData.department} onChange={e => updateField('department', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                  <option value="">Select department</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Finance">Finance</option>
                  <option value="HR">HR</option>
                  <option value="Sales">Sales</option>
                  <option value="Operations">Operations</option>
                </select>
              </FormField>
              <FormField label="Designation" id="designation" error={errors.designation}>
                <input id="designation" value={formData.designation} onChange={e => updateField('designation', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Senior Developer" />
              </FormField>
              <FormField label="Join Date" id="joinDate">
                <input id="joinDate" type="date" value={formData.joinDate} onChange={e => updateField('joinDate', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </FormField>
              <FormField label="Status" id="status">
                <select id="status" value={formData.status} onChange={e => updateField('status', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </FormField>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
            <h3 className="text-sm font-semibold text-ink-900">Contact Information</h3>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Phone" id="phone">
                <input id="phone" value={formData.phone} onChange={e => updateField('phone', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="+234 800 000 0000" />
              </FormField>
              <FormField label="Address" id="address">
                <input id="address" value={formData.address} onChange={e => updateField('address', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="123, Main Street, Lagos" />
              </FormField>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
            <h3 className="text-sm font-semibold text-ink-900">Emergency Contact</h3>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Contact Name" id="emergencyName">
                <input id="emergencyName" value={formData.emergencyName} onChange={e => updateField('emergencyName', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Next of kin" />
              </FormField>
              <FormField label="Phone" id="emergencyPhone">
                <input id="emergencyPhone" value={formData.emergencyPhone} onChange={e => updateField('emergencyPhone', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="+234 800 000 0000" />
              </FormField>
              <FormField label="Relation" id="emergencyRelation">
                <select id="emergencyRelation" value={formData.emergencyRelation} onChange={e => updateField('emergencyRelation', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                  <option value="">Select relation</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Child">Child</option>
                  <option value="Friend">Friend</option>
                  <option value="Other">Other</option>
                </select>
              </FormField>
            </div>
          </div>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl mt-6">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <p className="text-sm text-rose-600 dark:text-rose-400">Please fill in all required fields.</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6 pb-8">
          <button type="button" onClick={() => navigate('/app/hr/employees')}
            className="px-5 py-2.5 text-sm font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-2">
            <Save className="w-4 h-4" />
            {submitting ? 'Saving...' : isEdit ? 'Update Employee' : 'Create Employee'}
          </button>
        </div>
      </form>
    </HrPageShell>
  );
}

