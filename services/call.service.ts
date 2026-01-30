import { Alert, Linking } from 'react-native';
import { logCommunication } from './student.service';
import { supabase } from './supabase';

/**
 * Initiates a phone call to a student or parent
 * @param phoneNumber - The phone number to call
 * @param studentPrn - Student's PRN
 * @param callType - Type of call (student, father, mother)
 * @param gfmId - GFM's user ID
 */
export const initiateCall = async (
    phoneNumber: string,
    studentPrn: string,
    callType: 'student' | 'father' | 'mother',
    gfmId: string
) => {
    try {
        if (!phoneNumber) {
            Alert.alert('Error', 'Phone number not available');
            return;
        }

        // Log call attempt to database
        await logCommunication(gfmId, studentPrn, 'call', undefined, callType, phoneNumber);

        // Open device dialer
        const url = `tel:${phoneNumber}`;
        const canOpen = await Linking.canOpenURL(url);

        if (canOpen) {
            await Linking.openURL(url);
        } else {
            Alert.alert('Error', 'Cannot make calls on this device');
        }
    } catch (error) {
        console.error('Call initiation error:', error);
        Alert.alert('Error', 'Failed to initiate call');
    }
};

/**
 * Saves a pre-informed absence for a student
 * @param studentPrn - Student's PRN
 * @param gfmId - GFM's user ID
 * @param startDate - Start date of absence
 * @param endDate - End date of absence
 * @param reason - Reason for absence
 * @param proofUrl - URL to uploaded proof document
 * @param informedBy - Who informed (student/parent)
 * @param contactMethod - How they informed (phone/in_person/message)
 */
export const savePreInformedAbsence = async (
    studentPrn: string,
    gfmId: string,
    startDate: Date,
    endDate: Date,
    reason: string,
    proofUrl: string | null,
    informedBy: string,
    contactMethod: string
) => {
    try {
        const { error } = await supabase
            .from('pre_informed_absences')
            .insert({
                student_prn: studentPrn,
                gfm_id: gfmId,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                reason: reason,
                proof_url: proofUrl,
                informed_by: informedBy,
                contact_method: contactMethod
            });

        if (error) throw error;

        Alert.alert('Success', 'Pre-informed absence saved successfully');
        return true;
    } catch (error) {
        console.error('Error saving pre-informed absence:', error);
        Alert.alert('Error', 'Failed to save pre-informed absence');
        return false;
    }
};

/**
 * Checks if a student has a pre-informed absence for a specific date
 * @param studentPrn - Student's PRN
 * @param date - Date to check
 * @returns Pre-informed absence record or null
 */
export const checkIfPreInformed = async (
    studentPrn: string,
    date: Date
): Promise<any | null> => {
    try {
        const dateStr = date.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('pre_informed_absences')
            .select('*')
            .eq('student_prn', studentPrn)
            .lte('start_date', dateStr)
            .gte('end_date', dateStr)
            .maybeSingle();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error checking pre-informed status:', error);
        return null;
    }
};

/**
 * Gets all pre-informed absences for a GFM's students
 * @param gfmId - GFM's user ID
 * @returns Array of pre-informed absences
 */
export const getPreInformedAbsences = async (gfmId: string) => {
    try {
        const { data, error } = await supabase
            .from('pre_informed_absences')
            .select('*, students(full_name)')
            .eq('gfm_id', gfmId)
            .gte('end_date', new Date().toISOString().split('T')[0])
            .order('start_date', { ascending: false });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error fetching pre-informed absences:', error);
        return [];
    }
};

/**
 * Updates the follow-up status for a student
 * @param studentPrn - Student's PRN
 * @param gfmId - GFM's user ID
 * @param status - New status (pending, on_hold, contacted, resolved, pre_informed)
 * @param notes - Optional notes
 */
export const updateFollowUpStatus = async (
    studentPrn: string,
    gfmId: string,
    status: string,
    notes?: string
) => {
    try {
        const { error } = await supabase
            .from('attendance_follow_ups')
            .upsert({
                student_prn: studentPrn,
                gfm_id: gfmId,
                status: status,
                notes: notes,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'student_prn,gfm_id'
            });

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating follow-up status:', error);
        return false;
    }
};

/**
 * Gets the follow-up status for a student
 * @param studentPrn - Student's PRN
 * @param gfmId - GFM's user ID
 * @returns Follow-up record or null
 */
export const getFollowUpStatus = async (
    studentPrn: string,
    gfmId: string
) => {
    try {
        const { data, error } = await supabase
            .from('attendance_follow_ups')
            .select('*')
            .eq('student_prn', studentPrn)
            .eq('gfm_id', gfmId)
            .maybeSingle();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error fetching follow-up status:', error);
        return null;
    }
};
