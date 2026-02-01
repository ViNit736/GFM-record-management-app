const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env or .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BRANCH_MAPPINGS = {
    'CSE': 'Computer Engineering',
    'IT': 'Information Technology',
    'ENTC': 'Electronics & Telecommunication',
    'ECE': 'Electronics & Communication Engineering',
    'ME': 'Mechanical Engineering', // Keep ME/CE as input mapping to migrate them to full names
    'CE': 'Civil Engineering',
    'EE': 'Electrical Engineering'
};

const YEAR_MAPPINGS = {
    'FE': 'First Year',
    'SE': 'Second Year',
    'TE': 'Third Year',
    'BE': 'Final Year'
};

async function migrate() {
    console.log('🚀 Starting Migration to Full Names...');

    // 1. Migrate Students
    console.log('📦 Migrating Students table...');
    const { data: students, error: sError } = await supabase.from('students').select('prn, branch, year_of_study');
    if (sError) console.error('Error fetching students:', sError);
    else {
        for (const student of students) {
            const newBranch = BRANCH_MAPPINGS[student.branch] || student.branch;
            const newYear = YEAR_MAPPINGS[student.year_of_study] || student.year_of_study;
            if (newBranch !== student.branch || newYear !== student.year_of_study) {
                await supabase.from('students').update({
                    branch: newBranch,
                    year_of_study: newYear
                }).eq('prn', student.prn);
            }
        }
        console.log(`✅ Students migration check complete (${students.length} processed).`);
    }

    // 2. Migrate Attendance Sessions
    console.log('📅 Migrating Attendance Sessions...');
    const { data: sessions, error: sesError } = await supabase.from('attendance_sessions').select('id, department, academic_year');
    if (sesError) console.error('Error fetching sessions:', sesError);
    else {
        for (const session of sessions) {
            const newDept = BRANCH_MAPPINGS[session.department] || session.department;
            const newYear = YEAR_MAPPINGS[session.academic_year] || session.academic_year;
            if (newDept !== session.department || newYear !== session.academic_year) {
                await supabase.from('attendance_sessions').update({
                    department: newDept,
                    academic_year: newYear
                }).eq('id', session.id);
            }
        }
        console.log(`✅ Sessions migration check complete (${sessions.length} processed).`);
    }

    // 3. Migrate Teacher Batch Configs
    console.log('⚙️ Migrating Teacher Batch Configs...');
    const { data: configs, error: cError } = await supabase.from('teacher_batch_configs').select('id, department, class');
    if (cError) console.error('Error fetching configs:', cError);
    else {
        for (const config of configs) {
            const newDept = BRANCH_MAPPINGS[config.department] || config.department;
            const newYear = YEAR_MAPPINGS[config.class] || config.class;
            if (newDept !== config.department || newYear !== config.class) {
                await supabase.from('teacher_batch_configs').update({
                    department: newDept,
                    class: newYear
                }).eq('id', config.id);
            }
        }
        console.log(`✅ Configs migration check complete (${configs.length} processed).`);
    }

    // 4. Migrate Teacher Profiles
    console.log('👤 Migrating Teacher Profiles...');
    const { data: profiles, error: pError } = await supabase.from('teacher_profiles').select('id, department');
    if (pError) console.error('Error fetching profiles:', pError);
    else {
        for (const profile of profiles) {
            const newDept = BRANCH_MAPPINGS[profile.department] || profile.department;
            if (newDept !== profile.department) {
                await supabase.from('teacher_profiles').update({
                    department: newDept
                }).eq('id', profile.id);
            }
        }
        console.log(`✅ Profiles migration check complete (${profiles.length} processed).`);
    }

    console.log('✨ All migrations finished!');
}

migrate();
