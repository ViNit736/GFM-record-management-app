export const BRANCH_MAPPINGS: Record<string, string> = {
    'CSE': 'Computer Engineering',
    'IT': 'Information Technology',
    'ENTC': 'Electronics & Telecommunication',
    'ECE': 'Electronics & Communication Engineering',
    'MECH': 'Mechanical Engineering',
    'CIVIL': 'Civil Engineering',
    'EE': 'Electrical Engineering'
};

export const YEAR_MAPPINGS: Record<string, string> = {
    'FE': 'First Year',
    'SE': 'Second Year',
    'TE': 'Third Year',
    'BE': 'Final Year',
    'First Year': 'First Year',
    'Second Year': 'Second Year',
    'Third Year': 'Third Year',
    'Final Year': 'Final Year'
};

// For backward compatibility during migration
export const REVERSE_BRANCH_MAPPINGS: Record<string, string> = Object.entries(BRANCH_MAPPINGS).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
}, {} as Record<string, string>);

export const getFullBranchName = (abbr: string): string => BRANCH_MAPPINGS[abbr] || abbr;
export const getFullYearName = (abbr: string): string => YEAR_MAPPINGS[abbr] || abbr;

export const DISPLAY_BRANCHES = Object.values(BRANCH_MAPPINGS).filter((v, i, a) => a.indexOf(v) === i).map(name => ({
    label: name,
    value: name
}));

export const DISPLAY_YEARS = [
    { label: 'First Year', value: 'First Year' },
    { label: 'Second Year', value: 'Second Year' },
    { label: 'Third Year', value: 'Third Year' },
    { label: 'Final Year', value: 'Final Year' }
];
