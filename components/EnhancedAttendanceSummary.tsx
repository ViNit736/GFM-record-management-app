import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { checkIfPreInformed, initiateCall, savePreInformedAbsence, updateFollowUpStatus } from '../services/call.service';
import { getSession } from '../services/session.service';
import { pickAbsenceProof, uploadAbsenceProof } from '../services/storage.service';
import { supabase } from '../services/supabase';

interface EnhancedAttendanceSummaryProps {
    students: any[];
    batchConfig: any;
    onRefresh: () => void;
}

export const EnhancedAttendanceSummary: React.FC<EnhancedAttendanceSummaryProps> = ({
    students,
    batchConfig,
    onRefresh,
}) => {
    const [filterMode, setFilterMode] = useState<'all' | 'absent' | 'needs_contact'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [preInformedModal, setPreInformedModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Pre-informed absence form state
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [reason, setReason] = useState('');
    const [proofFile, setProofFile] = useState<any>(null);
    const [informedBy, setInformedBy] = useState<'student' | 'parent'>('student');
    const [contactMethod, setContactMethod] = useState<'phone' | 'in_person' | 'message'>('phone');
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    // Enhanced students with pre-informed status
    const [enhancedStudents, setEnhancedStudents] = useState<any[]>([]);

    useEffect(() => {
        loadPreInformedStatus();
    }, [students]);

    const loadPreInformedStatus = async () => {
        const todayStr = new Date().toISOString().split('T')[0];

        // Fetch calls for today for this batch area
        const { data: todayCalls } = await supabase
            .from('communication_logs')
            .select('student_prn')
            .eq('communication_type', 'call')
            .gte('created_at', todayStr + 'T00:00:00')
            .lte('created_at', todayStr + 'T23:59:59');

        const calledPrns = new Set(todayCalls?.map((c: any) => c.student_prn) || []);

        const today = new Date();
        const enhanced = await Promise.all(
            students.map(async (student) => {
                const preInformed = await checkIfPreInformed(student.prn, today);
                return {
                    ...student,
                    isPreInformed: !!preInformed,
                    preInformedReason: preInformed?.reason,
                    preInformedEndDate: preInformed?.end_date,
                    preInformedProof: preInformed?.proof_url,
                    calledToday: calledPrns.has(student.prn)
                };
            })
        );
        setEnhancedStudents(enhanced);
    };

    const handleCall = async (student: any, callType: 'student' | 'father' | 'mother') => {
        const session = await getSession();
        if (!session) {
            Alert.alert('Error', 'Session expired');
            return;
        }

        let phoneNumber = '';
        if (callType === 'student') phoneNumber = student.phone;
        else if (callType === 'father') phoneNumber = student.fatherPhone;
        else if (callType === 'mother') phoneNumber = student.motherPhone;

        if (!phoneNumber) {
            Alert.alert('Error', 'Phone number not available');
            return;
        }

        await initiateCall(phoneNumber, student.prn, callType, session.id);
    };

    const handleHold = async (student: any) => {
        const session = await getSession();
        if (!session) return;

        await updateFollowUpStatus(student.prn, session.id, 'on_hold');
        Alert.alert('Success', 'Student marked as on hold');
        onRefresh();
    };

    const openPreInformedDialog = (student: any) => {
        setSelectedStudent(student);
        setStartDate(new Date());
        setEndDate(new Date());
        setReason('');
        setProofFile(null);
        setInformedBy('student');
        setContactMethod('phone');
        setPreInformedModal(true);
    };

    const handlePickProof = async () => {
        const file = await pickAbsenceProof();
        if (file) {
            setProofFile(file);
        }
    };

    const handleSavePreInformed = async () => {
        if (!selectedStudent) return;

        if (!reason.trim()) {
            Alert.alert('Error', 'Please enter a reason for absence');
            return;
        }

        if (endDate < startDate) {
            Alert.alert('Error', 'End date must be after start date');
            return;
        }

        setLoading(true);
        try {
            const session = await getSession();
            if (!session) throw new Error('Session expired');

            let proofUrl: string | null = null;
            if (proofFile) {
                proofUrl = await uploadAbsenceProof(proofFile, selectedStudent.prn);
            }

            const success = await savePreInformedAbsence(
                selectedStudent.prn,
                session.id,
                startDate,
                endDate,
                reason,
                proofUrl,
                informedBy,
                contactMethod
            );

            if (success) {
                setPreInformedModal(false);
                loadPreInformedStatus();
                onRefresh();
            }
        } catch (error) {
            console.error('Error saving pre-informed absence:', error);
            Alert.alert('Error', 'Failed to save pre-informed absence');
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = enhancedStudents.filter((student) => {
        // Apply filter mode
        if (filterMode === 'absent' && student.status !== 'Absent') return false;
        if (filterMode === 'needs_contact' && (student.status !== 'Absent' || student.isPreInformed)) return false;

        // Apply search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                student.fullName?.toLowerCase().includes(query) ||
                student.prn?.toLowerCase().includes(query)
            );
        }

        return true;
    });

    const absentCount = enhancedStudents.filter(s => s.status === 'Absent').length;
    const needsContactCount = enhancedStudents.filter(s => s.status === 'Absent' && !s.isPreInformed).length;

    return (
        <View style={styles.container}>
            {/* Batch Info Header */}
            <View style={styles.batchInfoCard}>
                <View style={styles.batchHeader}>
                    <Ionicons name="people" size={24} color={COLORS.primary} />
                    <Text style={styles.batchTitle}>My Batch</Text>
                </View>
                <View style={styles.batchDetails}>
                    <Text style={styles.batchName}>
                        {batchConfig?.department} - {batchConfig?.class} - {batchConfig?.division}
                    </Text>
                    <Text style={styles.batchRange}>
                        RBT Range: {batchConfig?.rbt_from} - {batchConfig?.rbt_to}
                    </Text>
                    <Text style={styles.studentCount}>
                        Total Students: {enhancedStudents.length}
                    </Text>
                </View>
            </View>

            {/* Filter Buttons */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.filterButton, filterMode === 'all' && styles.filterButtonActive]}
                    onPress={() => setFilterMode('all')}
                >
                    <Text style={[styles.filterButtonText, filterMode === 'all' && styles.filterButtonTextActive]}>
                        All ({enhancedStudents.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterButton, filterMode === 'absent' && styles.filterButtonActive]}
                    onPress={() => setFilterMode('absent')}
                >
                    <Text style={[styles.filterButtonText, filterMode === 'absent' && styles.filterButtonTextActive]}>
                        Only Absent ({absentCount})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterButton, filterMode === 'needs_contact' && styles.filterButtonActive]}
                    onPress={() => setFilterMode('needs_contact')}
                >
                    <Text style={[styles.filterButtonText, filterMode === 'needs_contact' && styles.filterButtonTextActive]}>
                        Needs Contact ({needsContactCount})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color={COLORS.textLight} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or PRN..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery !== '' && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Student List */}
            <ScrollView style={styles.studentList}>
                {filteredStudents.map((student) => {
                    return (
                        <View key={student.prn} style={styles.studentCard}>
                            <View style={styles.studentInfo}>
                                <Text style={styles.studentName}>{student.fullName}</Text>
                                <Text style={styles.studentPrn}>{student.prn}</Text>
                                <Text style={[
                                    styles.studentStatus,
                                    student.status === 'Present' ? styles.statusPresent : styles.statusAbsent
                                ]}>
                                    {student.status || 'Unknown'}
                                </Text>

                                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 5 }}>
                                    {student.calledToday && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.secondary + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                                            <Ionicons name="call" size={14} color={COLORS.secondary} />
                                            <Text style={{ fontSize: 11, color: COLORS.secondary, fontWeight: 'bold', marginLeft: 4 }}>Called Today</Text>
                                        </View>
                                    )}
                                </View>

                                {student.isPreInformed && (
                                    <View style={styles.preInformedBadge}>
                                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                                        <Text style={styles.preInformedText}>
                                            Pre-Informed: {student.preInformedReason}
                                        </Text>
                                        <Text style={styles.preInformedDate}>
                                            Until: {new Date(student.preInformedEndDate).toLocaleDateString()}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {student.status === 'Absent' && !student.isPreInformed && (
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity
                                        style={styles.callButton}
                                        onPress={() => handleCall(student, 'student')}
                                    >
                                        <Ionicons name="call" size={18} color={COLORS.white} />
                                        <Text style={styles.callButtonText}>Call Student</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.callButton}
                                        onPress={() => handleCall(student, 'father')}
                                    >
                                        <Ionicons name="people" size={18} color={COLORS.white} />
                                        <Text style={styles.callButtonText}>Call Parent</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.holdButton}
                                        onPress={() => handleHold(student)}
                                    >
                                        <Ionicons name="pause" size={18} color={COLORS.text} />
                                        <Text style={styles.holdButtonText}>Hold</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.preInformButton}
                                        onPress={() => openPreInformedDialog(student)}
                                    >
                                        <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.primary} />
                                        <Text style={styles.preInformButtonText}>Add Leave Note</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}

                {filteredStudents.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="checkmark-done-circle" size={64} color={COLORS.textLight} />
                        <Text style={styles.emptyStateText}>No students found</Text>
                    </View>
                )}
            </ScrollView>

            {/* Pre-Informed Absence Modal */}
            <Modal
                visible={preInformedModal}
                animationType="slide"
                transparent
                onRequestClose={() => setPreInformedModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Mark as Pre-Informed Absence</Text>
                            <TouchableOpacity onPress={() => setPreInformedModal(false)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent}>
                            <Text style={styles.modalStudentInfo}>
                                Student: {selectedStudent?.fullName} ({selectedStudent?.prn})
                            </Text>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Start Date</Text>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setShowStartDatePicker(true)}
                                >
                                    <Text>{startDate.toLocaleDateString()}</Text>
                                    <Ionicons name="calendar" size={20} color={COLORS.primary} />
                                </TouchableOpacity>
                                {showStartDatePicker && (
                                    <DateTimePicker
                                        value={startDate}
                                        mode="date"
                                        onChange={(event, date) => {
                                            setShowStartDatePicker(Platform.OS === 'ios');
                                            if (date) setStartDate(date);
                                        }}
                                    />
                                )}
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>End Date</Text>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setShowEndDatePicker(true)}
                                >
                                    <Text>{endDate.toLocaleDateString()}</Text>
                                    <Ionicons name="calendar" size={20} color={COLORS.primary} />
                                </TouchableOpacity>
                                {showEndDatePicker && (
                                    <DateTimePicker
                                        value={endDate}
                                        mode="date"
                                        onChange={(event, date) => {
                                            setShowEndDatePicker(Platform.OS === 'ios');
                                            if (date) setEndDate(date);
                                        }}
                                    />
                                )}
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Reason for Absence</Text>
                                <TextInput
                                    style={styles.textArea}
                                    placeholder="e.g., Medical leave, Family emergency"
                                    value={reason}
                                    onChangeText={setReason}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Upload Proof (Optional)</Text>
                                <TouchableOpacity style={styles.uploadButton} onPress={handlePickProof}>
                                    <Ionicons name="document-attach" size={24} color={COLORS.primary} />
                                    <Text style={styles.uploadButtonText}>
                                        {proofFile ? proofFile.name : 'Choose File'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Informed By</Text>
                                <Picker
                                    selectedValue={informedBy}
                                    onValueChange={(value) => setInformedBy(value)}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Student" value="student" />
                                    <Picker.Item label="Parent" value="parent" />
                                </Picker>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Contact Method</Text>
                                <Picker
                                    selectedValue={contactMethod}
                                    onValueChange={(value) => setContactMethod(value)}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Phone Call" value="phone" />
                                    <Picker.Item label="In Person" value="in_person" />
                                    <Picker.Item label="Message/WhatsApp" value="message" />
                                </Picker>
                            </View>

                            <TouchableOpacity
                                style={styles.saveButton}
                                onPress={handleSavePreInformed}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={COLORS.white} />
                                ) : (
                                    <Text style={styles.saveButtonText}>Save Pre-Informed Absence</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    batchInfoCard: {
        backgroundColor: COLORS.white,
        padding: 20,
        marginBottom: 15,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    batchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    batchTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
        marginLeft: 10,
    },
    batchDetails: {
        marginLeft: 34,
    },
    batchName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 4,
    },
    batchRange: {
        fontSize: 14,
        color: COLORS.textLight,
        marginBottom: 4,
    },
    studentCount: {
        fontSize: 14,
        color: COLORS.textLight,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 15,
        gap: 10,
    },
    filterButton: {
        flex: 1,
        minWidth: '30%',
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: COLORS.white,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterButtonText: {
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '500',
    },
    filterButtonTextActive: {
        color: COLORS.white,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
        marginBottom: 15,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
    },
    studentList: {
        flex: 1,
    },
    studentCard: {
        backgroundColor: COLORS.white,
        padding: 15,
        marginBottom: 10,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    studentInfo: {
        marginBottom: 10,
    },
    studentName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 4,
    },
    studentPrn: {
        fontSize: 14,
        color: COLORS.textLight,
        marginBottom: 4,
    },
    studentStatus: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 4,
    },
    statusPresent: {
        color: COLORS.success,
    },
    statusAbsent: {
        color: COLORS.error,
    },
    preInformedBadge: {
        backgroundColor: '#e8f5e9',
        padding: 10,
        borderRadius: 6,
        marginTop: 8,
    },
    preInformedText: {
        fontSize: 13,
        color: COLORS.success,
        fontWeight: '500',
        marginLeft: 6,
    },
    preInformedDate: {
        fontSize: 12,
        color: COLORS.textLight,
        marginTop: 4,
    },
    actionButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        gap: 6,
    },
    callButtonText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '500',
    },
    holdButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff3e0',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        gap: 6,
    },
    holdButtonText: {
        color: COLORS.text,
        fontSize: 13,
        fontWeight: '500',
    },
    preInformButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e3f2fd',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        gap: 6,
    },
    preInformButtonText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyStateText: {
        fontSize: 16,
        color: COLORS.textLight,
        marginTop: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        width: '90%',
        maxWidth: 500,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    modalContent: {
        padding: 20,
    },
    modalStudentInfo: {
        fontSize: 14,
        color: COLORS.textLight,
        marginBottom: 20,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8,
    },
    dateButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    textArea: {
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 10,
    },
    uploadButtonText: {
        fontSize: 14,
        color: COLORS.text,
    },
    picker: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
    },
});
