export interface DemoContact {
  name: string
  email: string
  companyIndex: number // index into DEMO_COMPANIES
  role: string
  title: string
  isChampion: boolean
}

export const DEMO_CONTACTS: DemoContact[] = [
  // Acme Corp (index 0) - 2 contacts
  { name: 'Sarah Chen', email: 'sarah@acme.example.com', companyIndex: 0, role: 'Engineering', title: 'VP of Engineering', isChampion: true },
  { name: 'Marcus Johnson', email: 'marcus@acme.example.com', companyIndex: 0, role: 'Product', title: 'Senior PM', isChampion: false },
  // Globex Inc (index 1) - 2 contacts
  { name: 'Elena Kowalski', email: 'elena@globex.example.com', companyIndex: 1, role: 'Engineering', title: 'Tech Lead', isChampion: true },
  { name: 'James Wright', email: 'james@globex.example.com', companyIndex: 1, role: 'Operations', title: 'Operations Manager', isChampion: false },
  // Initech Systems (index 2) - 3 contacts
  { name: 'David Park', email: 'david@initech.example.com', companyIndex: 2, role: 'Engineering', title: 'CTO', isChampion: true },
  { name: 'Priya Sharma', email: 'priya@initech.example.com', companyIndex: 2, role: 'Support', title: 'Head of Support', isChampion: false },
  { name: 'Rachel Torres', email: 'rachel@initech.example.com', companyIndex: 2, role: 'Product', title: 'Director of Product', isChampion: false },
  // Umbrella Labs (index 3) - 1 contact
  { name: 'Tom Mueller', email: 'tom@umbrellalabs.example.com', companyIndex: 3, role: 'Product', title: 'Product Manager', isChampion: false },
  // Meridian Health (index 4) - 2 contacts
  { name: 'Dr. Lisa Chang', email: 'lisa@meridianhealth.example.com', companyIndex: 4, role: 'Product', title: 'Chief Product Officer', isChampion: true },
  { name: 'Kevin O\'Brien', email: 'kevin@meridianhealth.example.com', companyIndex: 4, role: 'Engineering', title: 'Lead Developer', isChampion: false },
  // NovaTech Solutions (index 5) - 2 contacts
  { name: 'Alex Rivera', email: 'alex@novatech.example.com', companyIndex: 5, role: 'Engineering', title: 'Staff Engineer', isChampion: true },
  { name: 'Samantha Lee', email: 'samantha@novatech.example.com', companyIndex: 5, role: 'Product', title: 'VP Product', isChampion: false },
  // BrightPath Education (index 6) - 2 contacts
  { name: 'Michael Foster', email: 'michael@brightpath.example.com', companyIndex: 6, role: 'Operations', title: 'COO', isChampion: true },
  { name: 'Nina Patel', email: 'nina@brightpath.example.com', companyIndex: 6, role: 'Engineering', title: 'Engineering Manager', isChampion: false },
  // Apex Logistics (index 7) - 0 contacts (prospect)
  // Quantum Analytics (index 8) - 1 contact
  { name: 'Chris Nakamura', email: 'chris@quantumanalytics.example.com', companyIndex: 8, role: 'Engineering', title: 'Lead Data Engineer', isChampion: true },
  // Sterling Financial (index 9) - 2 contacts
  { name: 'Victoria Adams', email: 'victoria@sterlingfin.example.com', companyIndex: 9, role: 'Product', title: 'SVP Digital Products', isChampion: true },
  { name: 'Robert Kim', email: 'robert@sterlingfin.example.com', companyIndex: 9, role: 'Engineering', title: 'Principal Architect', isChampion: false },
]
