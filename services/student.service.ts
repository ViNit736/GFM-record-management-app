import { YEAR_MAPPINGS } from '../constants/Mappings';
import {
    Student,
    getStudentsByDivision,
    getStudentsByRbtRange,
    getTeacherBatchConfig
} from '../storage/sqlite';
import { supabase } from './supabase';

export const getStudentsForGFM = async (gfmId: string): Promise<Student[]> => {
    console.log('Fetching students for GFM:', gfmId);

    // 1. Get Batch Config
    const config = await getTeacherBatchConfig(gfmId);

    if (!config || config.status !== 'Approved') {
        console.log('No approved batch config found for GFM, returning empty list.');
        return [];
    }

    const { department, division, rbtFrom, rbtTo } = config;
    // Mappings for Class -> Year of Study
    let yearOfStudy = config.class;
    if (YEAR_MAPPINGS[yearOfStudy]) {
        yearOfStudy = YEAR_MAPPINGS[yearOfStudy];
    } else if (yearOfStudy === 'SE') yearOfStudy = 'Second Year';
    else if (yearOfStudy === 'TE') yearOfStudy = 'Third Year';
    else if (yearOfStudy === 'BE') yearOfStudy = 'Final Year';
    else if (yearOfStudy === 'FE') yearOfStudy = 'First Year';

    console.log(`Filter criteria: Dept=${department}, Year=${yearOfStudy}, Div=${division}, Range=${rbtFrom}-${rbtTo}`);

    // 2. Fetch based on config
    let students: Student[] = [];

    if (rbtFrom && rbtTo) {
        students = await getStudentsByRbtRange(department, yearOfStudy, division, rbtFrom, rbtTo);
    } else {
        students = await getStudentsByDivision(department, yearOfStudy, division);
    }

    return students;
};

export const logCommunication = async (
    gfmPrn: string | undefined,
    studentPrn: string,
    type: 'call' | 'whatsapp',
    notes?: string,
    contactPerson?: string,
    phoneNumber?: string,
    timestamp?: string,
    reason?: string,
    customDescription?: string,
    reportUrl?: string
) => {
    let gfmIdToUse = gfmPrn;

    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (gfmPrn && !isUuid(gfmPrn)) {
        const { data } = await supabase.from('profiles').select('id').eq('prn', gfmPrn).single();
        if (data) gfmIdToUse = data.id;
    }

    if (!gfmIdToUse) {
        console.error('No GFM ID provided for logging');
        return;
    }

    const { error } = await supabase
        .from('communication_logs')
        .insert({
            gfm_id: gfmIdToUse,
            student_prn: studentPrn,
            communication_type: type,
            notes: notes || `Called ${contactPerson || 'Student'} at ${phoneNumber}`,
            reason: reason,
            custom_description: customDescription,
            report_url: reportUrl,
            call_timestamp: timestamp || new Date().toISOString(),
            created_at: new Date().toISOString()
        });

    if (error) {
        console.error('Error logging communication:', error);
    } else {
        console.log(`Logged ${type} to ${studentPrn}`);
    }
};
