import { supabase } from './supabase';

export const seedMockData = async () => {
    try {
        console.log('🌱 Seeding mock data...');
        const today = new Date().toISOString().split('T')[0];

        // 0. Get a real teacher ID to avoid FK constraints
        const { data: teacher, error: tError } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'teacher')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (tError || !teacher) {
            console.error('❌ Could not fetch real teacher for seeding.', tError?.message);
            throw new Error('Seeding requires at least one teacher profile in the database.');
        }

        const teacherId = teacher.id;

        // 1. Create Fake Attendance Sessions
        const sessions = [
            { department: 'CSE', academic_year: 'TE', division: 'A', date: today, subject: 'DBMS', type: 'Theory', teacher_id: teacherId },
            { department: 'CSE', academic_year: 'TE', division: 'B', date: today, subject: 'CN', type: 'Theory', teacher_id: teacherId },
        ];

        const { data: sessionData, error: sessionError } = await supabase
            .from('attendance_sessions')
            .insert(sessions)
            .select();

        if (sessionError) {
            console.error('❌ Session creation failed:', JSON.stringify(sessionError, null, 2));
            throw sessionError;
        }

        if (!sessionData || sessionData.length === 0) {
            console.log('ℹ️ No sessions created/updated (might already exist).');
            return true;
        }

        console.log('✅ Created/Updated Sessions:', sessionData.length);

        // 2. Create Fake Absent Records
        const sessionId = sessionData[0].id;
        const badStudents = [
            { student_prn: '72200001K', session_id: sessionId, status: 'Absent', remark: 'Mock Absent 1' },
            { student_prn: '72200002L', session_id: sessionId, status: 'Absent', remark: 'Mock Absent 2' }
        ];

        const { error: attError } = await supabase
            .from('attendance_records')
            .upsert(badStudents, { onConflict: 'student_prn,session_id' });

        if (attError) {
            console.warn('⚠️ Attendance record insertion failed:', JSON.stringify(attError, null, 2));
        } else {
            console.log('✅ Created Absent Records');
        }

        // 3. Create Fake Call Logs
        const logs = [
            {
                student_prn: '72200001K',
                gfm_id: teacherId,
                communication_type: 'call',
                reason: 'Sick',
                created_at: new Date().toISOString()
            }
        ];

        const { error: logError } = await supabase
            .from('communication_logs')
            .insert(logs);

        if (logError) console.warn('ℹ️ Call log creation skipped or warning:', logError.message);
        else console.log('✅ Created Call Logs');

        return true;

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        return false;
    }
};
