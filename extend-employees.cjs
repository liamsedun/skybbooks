const fs = require("fs");
const content = fs.readFileSync("src/pages/payroll/EmployeesPage.tsx", "utf8");

// Check if already updated
if (content.includes("RepeatableSection")) {
  console.log("Already updated");
  process.exit(0);
}

const additions = `
const EDU_LEVELS = ['SSCE / WAEC', 'OND', 'HND', 'B.Sc / B.A', 'M.Sc / M.A', 'MBA', 'Ph.D', 'Others'];

function SectionHeader({ icon: Icon, title }: any) {
  return (
    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
      <Icon className="w-3.5 h-3.5" /> {title}
    </h4>
  );
}

function RepeatableSection({ title, icon: Icon, items, setItems, fields, maxItems = 5 }: any) {
  function addItem() {
    if (items.length >= maxItems) return;
    const blank: any = {};
    fields.forEach((f: any) => { blank[f.key] = ''; });
    setItems([...items, blank]);
  }
  function removeItem(i: number) { setItems(items.filter((_: any, idx: number) => idx !== i)); }
  function updateItem(i: number, key: string, val: string) {
    setItems(items.map((item: any, idx: number) => idx === i ? { ...item, [key]: val } : item));
  }
  return (
    <div className="space-y-3 border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between">
        <SectionHeader icon={Icon} title={title} />
        {items.length < maxItems && (
          <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>
      {items.length === 0 && (
        <button type="button" onClick={addItem} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition flex items-center justify-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Add {title}
        </button>
      )}
      {items.map((item: any, i: number) => (
        <div key={i} className="bg-slate-50 rounded-xl p-4 relative">
          <button type="button" onClick={() => removeItem(i)} className="absolute top-3 right-3 p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="grid grid-cols-2 gap-3 pr-6">
            {fields.map((f: any) => (
              f.type === 'select'
                ? <div key={f.key} className={f.span2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                    <select value={item[f.key]} onChange={e => updateItem(i, f.key, e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-indigo-400 outline-none transition">
                      <option value="">— Select —</option>
                      {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                : <div key={f.key} className={f.span2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                    <input type={f.type || 'text'} value={item[f.key]} onChange={e => updateItem(i, f.key, e.target.value)} placeholder={f.placeholder || ''} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-indigo-400 outline-none transition" />
                  </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
`;

// Add new imports
let updated = content
  .replace(
    "  User, Mail, Phone, Building2, Briefcase, CreditCard,\n  Calendar, Hash, CheckCircle, XCircle, ChevronDown, Save",
    "  User, Phone, Briefcase, CreditCard,\n  CheckCircle, XCircle, Save, GraduationCap,\n  Award, Building2, Heart, Shield, Users, Plus, Trash2"
  )
  // Add EDU_LEVELS and RepeatableSection before emptyForm
  .replace("const emptyForm = {", additions + "\nconst emptyForm = {")
  // Add address to emptyForm
  .replace(
    "  staffId: '', firstName: '', lastName: '', email: '', phone: '',\n  department: '', designation: '', dateOfBirth: '', dateHired: '',",
    "  staffId: '', firstName: '', lastName: '', email: '', phone: '',\n  address: '', department: '', designation: '', dateOfBirth: '', dateHired: '',"
  );

// Add repeatable state variables after filterStatus state
updated = updated.replace(
  "  const [filterStatus, setFilterStatus] = useState('all');",
  `  const [filterStatus, setFilterStatus] = useState('all');
  const [eduQuals, setEduQuals] = useState<any[]>([]);
  const [profQuals, setProfQuals] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [nextOfKin, setNextOfKin] = useState<any[]>([]);
  const [guarantors, setGuarantors] = useState<any[]>([]);
  const [references, setReferences] = useState<any[]>([]);`
);

// Update resetForm
updated = updated.replace(
  "  function resetForm() { setForm({ ...emptyForm }); setShowForm(false); setEditingId(null); }",
  `  function resetForm() {
    setForm({ ...emptyForm });
    setEduQuals([]); setProfQuals([]); setInstitutions([]);
    setNextOfKin([]); setGuarantors([]); setReferences([]);
    setShowForm(false); setEditingId(null);
  }`
);

// Update openEdit to include address
updated = updated.replace(
  "      email: emp.email || '', phone: emp.phone || '', department: emp.department || '',",
  "      email: emp.email || '', phone: emp.phone || '', address: emp.address || '', department: emp.department || '',"
);

// Update handleSubmit to include extra fields
updated = updated.replace(
  "    const payload = { ...form, grossSalary: Math.round(Number(form.grossSalary) * 100) };",
  "    const payload = { ...form, grossSalary: Math.round(Number(form.grossSalary) * 100), eduQuals, profQuals, institutions, nextOfKin, guarantors, references };"
);

// Add address field to Personal Information section
updated = updated.replace(
  '                  <Field label="Date of Birth" value={form.dateOfBirth} onChange={f(\'dateOfBirth\')} type="date" />\n                </div>',
  `                  <Field label="Date of Birth" value={form.dateOfBirth} onChange={f('dateOfBirth')} type="date" />
                  <div className="col-span-2">
                    <Field label="Residential Address" value={form.address} onChange={f('address')} placeholder="12 Main Street, Lagos" />
                  </div>
                </div>`
);

// Add new sections before submit buttons
updated = updated.replace(
  '              <div className="sticky bottom-0 bg-white border-t border-slate-100 pt-4 flex gap-3">',
  `              {/* Educational Qualifications */}
              <RepeatableSection title="Educational Qualifications" icon={GraduationCap} items={eduQuals} setItems={setEduQuals} maxItems={5}
                fields={[
                  { key: 'level', label: 'Qualification Level', type: 'select', options: EDU_LEVELS },
                  { key: 'course', label: 'Course / Field of Study', placeholder: 'Computer Science' },
                  { key: 'institution', label: 'Institution', placeholder: 'University of Lagos', span2: true },
                  { key: 'year', label: 'Year Obtained', type: 'number', placeholder: '2015' },
                ]} />

              {/* Professional Qualifications */}
              <RepeatableSection title="Professional Qualifications" icon={Award} items={profQuals} setItems={setProfQuals} maxItems={5}
                fields={[
                  { key: 'qualification', label: 'Qualification', placeholder: 'ICAN, CIPM, PMP...' },
                  { key: 'issuingBody', label: 'Issuing Body', placeholder: 'ICAN' },
                  { key: 'year', label: 'Year Obtained', type: 'number', placeholder: '2018' },
                ]} />

              {/* Institutions Attended */}
              <RepeatableSection title="Institutions Attended" icon={Building2} items={institutions} setItems={setInstitutions} maxItems={5}
                fields={[
                  { key: 'name', label: 'Institution Name', placeholder: 'University of Lagos', span2: true },
                  { key: 'type', label: 'Type', type: 'select', options: ['Primary', 'Secondary', 'Polytechnic', 'University', 'Professional', 'Others'] },
                  { key: 'certificate', label: 'Certificate Obtained', placeholder: 'B.Sc Computer Science' },
                  { key: 'from', label: 'From (Year)', type: 'number', placeholder: '2010' },
                  { key: 'to', label: 'To (Year)', type: 'number', placeholder: '2014' },
                ]} />

              {/* Next of Kin */}
              <RepeatableSection title="Next of Kin" icon={Heart} items={nextOfKin} setItems={setNextOfKin} maxItems={1}
                fields={[
                  { key: 'name', label: 'Full Name', placeholder: 'Jane Doe', span2: true },
                  { key: 'relationship', label: 'Relationship', placeholder: 'Spouse / Sibling' },
                  { key: 'phone', label: 'Phone Number', placeholder: '+234 801 234 5678' },
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'jane@example.com' },
                  { key: 'address', label: 'Address', placeholder: '12 Main Street, Lagos', span2: true },
                ]} />

              {/* Guarantors */}
              <RepeatableSection title="Guarantors" icon={Shield} items={guarantors} setItems={setGuarantors} maxItems={3}
                fields={[
                  { key: 'name', label: 'Full Name', placeholder: 'Mr. John Smith', span2: true },
                  { key: 'occupation', label: 'Occupation', placeholder: 'Civil Servant' },
                  { key: 'relationship', label: 'Relationship', placeholder: 'Friend / Colleague' },
                  { key: 'phone', label: 'Phone Number', placeholder: '+234 801 234 5678' },
                  { key: 'address', label: 'Address', placeholder: '12 Main Street, Lagos', span2: true },
                ]} />

              {/* References */}
              <RepeatableSection title="References" icon={Users} items={references} setItems={setReferences} maxItems={3}
                fields={[
                  { key: 'name', label: 'Full Name', placeholder: 'Dr. Adaeze Obi', span2: true },
                  { key: 'title', label: 'Title / Designation', placeholder: 'Director, Finance' },
                  { key: 'organization', label: 'Organisation', placeholder: 'ABC Ltd' },
                  { key: 'phone', label: 'Phone Number', placeholder: '+234 801 234 5678' },
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'adaeze@abc.com' },
                ]} />

              <div className="sticky bottom-0 bg-white border-t border-slate-100 pt-4 flex gap-3">`
);

fs.writeFileSync("src/pages/payroll/EmployeesPage.tsx", updated);
console.log("Done - " + updated.split('\n').length + " lines");
