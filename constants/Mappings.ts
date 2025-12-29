export const BRANCH_MAPPINGS: Record<string, string> = {
    'CSE': 'Computer Engineering',
    'IT': 'Information Technology',
    'ENTC': 'Electronics & Telecommunication',
    'ECE': 'Electronics & Communication Engineering',
    'MECH': 'Mechanical Engineering',
    'ME': 'Mechanical Engineering',
    'CIVIL': 'Civil Engineering',
    'CE': 'Civil Engineering',
    'EE': 'Electrical Engineering',
    'AIDS': 'Artificial Intelligence & Data Science',
    'AIML': 'Artificial Intelligence & Machine Learning'
};

export const YEAR_MAPPINGS: Record<string, string> = {
    '1st': 'First Year',
    '2nd': 'Second Year',
    '3rd': 'Third Year',
    '4th': 'Final Year',
    'FE': 'First Year',
    'SE': 'Second Year',
    'TE': 'Third Year',
    'BE': 'Final Year'
};

export const REVERSE_BRANCH_MAPPINGS: Record<string, string> = Object.entries(BRANCH_MAPPINGS).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
}, {} as Record<string, string>);

export const REVERSE_YEAR_MAPPINGS: Record<string, string> = Object.entries(YEAR_MAPPINGS).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
}, {} as Record<string, string>);

export const getFullBranchName = (abbr: string): string => BRANCH_MAPPINGS[abbr] || abbr;
export const getFullYearName = (abbr: string): string => YEAR_MAPPINGS[abbr] || abbr;

