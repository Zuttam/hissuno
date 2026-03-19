export interface DemoCompany {
  name: string
  domain: string
  stage: string
  industry: string
  arr: number
  planTier: string
  employeeCount: number
  country: string
  healthScore: number
}

export const DEMO_COMPANIES: DemoCompany[] = [
  {
    name: 'Acme Corp',
    domain: 'acme.example.com',
    stage: 'active',
    industry: 'SaaS',
    arr: 120000,
    planTier: 'Pro',
    employeeCount: 85,
    country: 'US',
    healthScore: 82,
  },
  {
    name: 'Globex Inc',
    domain: 'globex.example.com',
    stage: 'onboarding',
    industry: 'Fintech',
    arr: 45000,
    planTier: 'Starter',
    employeeCount: 32,
    country: 'UK',
    healthScore: 65,
  },
  {
    name: 'Initech Systems',
    domain: 'initech.example.com',
    stage: 'expansion',
    industry: 'Enterprise Software',
    arr: 280000,
    planTier: 'Enterprise',
    employeeCount: 420,
    country: 'US',
    healthScore: 91,
  },
  {
    name: 'Umbrella Labs',
    domain: 'umbrellalabs.example.com',
    stage: 'churned',
    industry: 'Biotech',
    arr: 0,
    planTier: 'Starter',
    employeeCount: 15,
    country: 'DE',
    healthScore: 12,
  },
  {
    name: 'Meridian Health',
    domain: 'meridianhealth.example.com',
    stage: 'active',
    industry: 'Healthcare',
    arr: 95000,
    planTier: 'Pro',
    employeeCount: 210,
    country: 'US',
    healthScore: 78,
  },
  {
    name: 'NovaTech Solutions',
    domain: 'novatech.example.com',
    stage: 'expansion',
    industry: 'DevTools',
    arr: 180000,
    planTier: 'Enterprise',
    employeeCount: 150,
    country: 'US',
    healthScore: 88,
  },
  {
    name: 'BrightPath Education',
    domain: 'brightpath.example.com',
    stage: 'active',
    industry: 'EdTech',
    arr: 62000,
    planTier: 'Pro',
    employeeCount: 45,
    country: 'CA',
    healthScore: 71,
  },
  {
    name: 'Apex Logistics',
    domain: 'apexlogistics.example.com',
    stage: 'prospect',
    industry: 'Logistics',
    arr: 0,
    planTier: '',
    employeeCount: 300,
    country: 'US',
    healthScore: 50,
  },
  {
    name: 'Quantum Analytics',
    domain: 'quantumanalytics.example.com',
    stage: 'onboarding',
    industry: 'Data Analytics',
    arr: 35000,
    planTier: 'Starter',
    employeeCount: 22,
    country: 'AU',
    healthScore: 60,
  },
  {
    name: 'Sterling Financial',
    domain: 'sterlingfin.example.com',
    stage: 'active',
    industry: 'Financial Services',
    arr: 210000,
    planTier: 'Enterprise',
    employeeCount: 550,
    country: 'US',
    healthScore: 85,
  },
]
