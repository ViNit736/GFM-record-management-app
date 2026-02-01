import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { DISPLAY_BRANCHES, DISPLAY_YEARS, getFullBranchName, getFullYearName } from '../../constants/Mappings';
import { supabase } from '../../services/supabase';
import { deleteBatchAllocation, deleteBatchDefinition } from '../../storage/sqlite';

const ManageAllocations = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [allocations, setAllocations] = useState<any[]>([]);
    const [batchDefinitions, setBatchDefinitions] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'batch' | 'assignment'>('batch');
    const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [rbtSuggestions, setRbtSuggestions] = useState<any[]>([]);
    const [activeInput, setActiveInput] = useState<'from' | 'to' | null>(null);

    // Batch Form State (Aligned with Database Keys)
    const [batchForm, setBatchForm] = useState({
        department: 'Computer Engineering',
        class: 'First Year',
        division: 'A',
        sub_batch: '',
        rbt_from: '',
        rbt_to: '',
        academic_year: '2024-25'
    });

    // Assignment Form State
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [selectedBatchId, setSelectedBatchId] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    // Load students for RBT suggestions
    useEffect(() => {
        if (modalVisible && modalType === 'batch') {
            console.log(`🔍 [Admin] Loading students for: ${batchForm.department} ${batchForm.class} ${batchForm.division}`);
            loadStudentsForSuggestions();
        }
    }, [batchForm.department, batchForm.class, batchForm.division, modalVisible, modalType]);

    // Enhanced Roll Number suggestions
    useEffect(() => {
        const query = (activeInput === 'from' ? batchForm.rbt_from : batchForm.rbt_to).toLowerCase();
        if (activeInput && students.length > 0) {
            const filtered = students
                .filter(s => {
                    // Strict Context Check: Ensure student matches CURRENT form selection
                    const matchesContext =
                        s.branch === batchForm.department &&
                        s.year_of_study === batchForm.class &&
                        s.division === batchForm.division;

                    if (!matchesContext) return false;
                    if (!query) return true; // Show top results if empty

                    const matchRoll = s.roll_no && s.roll_no.toString().toLowerCase().includes(query);
                    return matchRoll;
                })
                .map(s => ({
                    roll: s.roll_no.toString(),
                    name: s.full_name,
                    prn: s.prn.toString()
                }))
                .slice(0, 10);
            setRbtSuggestions(filtered);
        } else {
            setRbtSuggestions([]);
        }
    }, [batchForm.rbt_from, batchForm.rbt_to, activeInput, students, batchForm.department, batchForm.class, batchForm.division]);

    const loadStudentsForSuggestions = async () => {
        try {
            const { data } = await supabase
                .from('students')
                .select('prn, full_name, roll_no, branch, year_of_study, division')
                .eq('branch', batchForm.department)
                .eq('year_of_study', batchForm.class)
                .eq('division', batchForm.division)
                .order('prn');
            setStudents(data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch Batch Definitions
            const { data: bData, error: bError } = await supabase
                .from('batch_definitions')
                .select('*')
                .order('created_at', { ascending: false });
            if (bError) throw bError;
            setBatchDefinitions(bData || []);

            // Fetch Teachers
            const { data: teacherData } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'teacher')
                .order('full_name');
            setTeachers(teacherData || []);

            // Fetch Allocations
            const { data: allocData, error: aError } = await supabase
                .from('teacher_batch_configs')
                .select('*, profiles(full_name), batch_definitions(*)')
                .order('created_at', { ascending: false });

            if (aError) throw aError;
            setAllocations(allocData || []);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBatch = async () => {
        if (!batchForm.rbt_from || !batchForm.rbt_to) {
            Alert.alert('Error', 'Roll No range is required');
            return;
        }
        setLoading(true);
        try {
            if (editingBatchId) {
                // Update existing batch
                const { error } = await supabase
                    .from('batch_definitions')
                    .update(batchForm)
                    .eq('id', editingBatchId);
                if (error) throw error;
                Alert.alert('Success', 'Batch updated successfully');
            } else {
                // Create new batch
                const { error } = await supabase.from('batch_definitions').insert([batchForm]);
                if (error) throw error;
                Alert.alert('Success', 'Batch defined successfully');
            }
            setModalVisible(false);
            setEditingBatchId(null);
            loadData();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAssignment = async () => {
        if (!selectedTeacher || !selectedBatchId) {
            Alert.alert('Error', 'Please select teacher and batch');
            return;
        }
        setLoading(true);
        try {
            const batch = batchDefinitions.find(b => b.id === selectedBatchId);
            const teacher = teachers.find(t => t.id === selectedTeacher);

            // 1. Update Allocation
            const { error: allocError } = await supabase.from('teacher_batch_configs').upsert({
                teacher_id: selectedTeacher,
                batch_definition_id: selectedBatchId,
                batch_name: `${getFullBranchName(batch.department)} ${getFullYearName(batch.class)} Div ${batch.division}${batch.sub_batch || ''} (${batch.rbt_from}-${batch.rbt_to})`,
                department: batch.department,
                class: batch.class,
                division: `${batch.division}${batch.sub_batch || ''}`,
                rbt_from: batch.rbt_from,
                rbt_to: batch.rbt_to,
                academic_year: batch.academic_year
            }, { onConflict: 'teacher_id' });

            if (allocError) throw allocError;

            // 2. Sync GFM to Students (using robust numeric range matching)
            const { data: studentsInRange, error: fetchError } = await supabase
                .from('students')
                .select('prn, roll_no')
                .eq('branch', batch.department)
                .eq('year_of_study', batch.class)
                .eq('division', batch.division);

            if (!fetchError && studentsInRange) {
                const extractTailNum = (str: string) => {
                    const match = String(str).match(/\d+$/);
                    return match ? parseInt(match[0]) : NaN;
                };

                const fNum = extractTailNum(batch.rbt_from);
                const tNum = extractTailNum(batch.rbt_to);

                const updatablePrns = studentsInRange.filter(s => {
                    const sNum = extractTailNum(s.roll_no || s.prn);
                    if (isNaN(fNum) || isNaN(tNum) || isNaN(sNum)) return false;

                    // Modulo logic for multi-year safety
                    const seq = sNum % 1000;
                    const fSeq = fNum % 1000;
                    const tSeq = tNum % 1000;
                    return seq >= fSeq && seq <= tSeq;
                }).map(s => s.prn);

                if (updatablePrns.length > 0) {
                    await supabase
                        .from('students')
                        .update({ gfm_id: selectedTeacher, gfm_name: teacher?.full_name })
                        .in('prn', updatablePrns);
                }
            }

            Alert.alert('Success', 'GFM assigned and students synced');
            setModalVisible(false);
            loadData();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBatch = async (id: string) => {
        console.log('🔴 Delete button clicked for batch ID:', id);

        const confirmed = Platform.OS === 'web'
            ? window.confirm('Delete Batch Definition\n\nThis will delete:\n• The batch definition\n• All GFM assignments\n\n✅ Attendance data will be PRESERVED\n\nContinue?')
            : await new Promise((resolve) => {
                Alert.alert(
                    'Delete Batch Definition',
                    'This will delete:\n\n• The batch definition\n• All GFM assignments\n\n✅ Attendance data PRESERVED\n\nContinue?',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) }
                    ]
                );
            });

        if (!confirmed) return;

        try {
            setLoading(true);
            await deleteBatchDefinition(id);
            loadData();
            if (Platform.OS === 'web') {
                alert('Success: Batch deleted (attendance preserved)');
            } else {
                Alert.alert('Success', 'Batch deleted (attendance preserved)');
            }
        } catch (error: any) {
            console.error('Delete error:', error);
            if (Platform.OS === 'web') {
                alert('Error: ' + (error.message || 'Failed to delete batch. Check console for details.'));
            } else {
                Alert.alert('Error', error.message || 'Failed to delete batch. Please check console for details.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAssignment = async (id: string) => {
        Alert.alert('Remove GFM', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: async () => {
                    try {
                        setLoading(true);
                        await deleteBatchAllocation(id);
                        loadData();
                        Alert.alert('Success', 'GFM assignment removed');
                    } catch (error: any) {
                        Alert.alert('Error', 'Failed to remove assignment');
                    } finally {
                        setLoading(false);
                    }
                }
            }
        ]);
    };

    const openModal = (type: 'batch' | 'assignment') => {
        setModalType(type);
        setEditingBatchId(null);
        setBatchForm({
            department: 'Computer Engineering',
            class: 'Second Year',
            division: 'A',
            sub_batch: '',
            rbt_from: '',
            rbt_to: '',
            academic_year: '2024-25'
        });
        setModalVisible(true);
    };

    const handleEditBatch = (batch: any) => {
        setEditingBatchId(batch.id);
        setBatchForm({
            department: batch.department,
            class: batch.class,
            division: batch.division,
            sub_batch: batch.sub_batch || '',
            rbt_from: batch.rbt_from,
            rbt_to: batch.rbt_to,
            academic_year: batch.academic_year
        });
        setModalType('batch');
        setModalVisible(true);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.title}>GFM Management</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Step 1: Define Batches Card */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepText}>Step 1</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Define Batches</Text>
                        <TouchableOpacity style={styles.miniAddBtn} onPress={() => openModal('batch')}>
                            <Ionicons name="add" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.sectionDesc}>Create sub-batches and Roll No ranges for each division.</Text>

                    <View style={styles.listArea}>
                        {batchDefinitions.map(b => (
                            <View key={b.id} style={styles.listItem}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>
                                        {getFullYearName(b.class)} Div {b.division}{b.sub_batch ? `${b.sub_batch}` : ''}
                                    </Text>
                                    <View style={styles.rbtRow}>
                                        <Ionicons name="list-outline" size={12} color={COLORS.primary} />
                                        <Text style={styles.itemRbt}>Roll Range: {b.rbt_from} - {b.rbt_to}</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <TouchableOpacity onPress={() => handleEditBatch(b)}>
                                        <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteBatch(b.id)}>
                                        <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                        {batchDefinitions.length === 0 && <Text style={styles.emptyText}>No batches defined yet.</Text>}
                    </View>
                </View>

                {/* Step 2: Assign GFMs Card */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.stepBadge, { backgroundColor: COLORS.secondary }]}>
                            <Text style={styles.stepText}>Step 2</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Assign GFMs</Text>
                        <TouchableOpacity style={[styles.miniAddBtn, { backgroundColor: COLORS.secondary }]} onPress={() => openModal('assignment')}>
                            <Ionicons name="add" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.sectionDesc}>Link teachers to the batches defined above.</Text>

                    <View style={styles.listArea}>
                        {allocations.map(a => (
                            <View key={a.id} style={styles.listItem}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>{a.profiles?.full_name}</Text>
                                    <Text style={styles.itemSubText}>{a.batch_name}</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleDeleteAssignment(a.id)}>
                                    <Ionicons name="close-circle-outline" size={20} color={COLORS.error} />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {allocations.length === 0 && <Text style={styles.emptyText}>No GFM assignments yet.</Text>}
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{modalType === 'batch' ? (editingBatchId ? 'Edit Batch' : 'Define New Batch') : 'Assign GFM to Batch'}</Text>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {modalType === 'batch' ? (
                                <>
                                    <Text style={styles.label}>Department</Text>
                                    <View style={styles.pickerWrapper}>
                                        <Picker selectedValue={batchForm.department} onValueChange={v => setBatchForm({ ...batchForm, department: v })}>
                                            {DISPLAY_BRANCHES.map(b => <Picker.Item key={b.value} label={b.label} value={b.value} />)}
                                        </Picker>
                                    </View>
                                    <View style={styles.row}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.label}>Year</Text>
                                            <View style={styles.pickerWrapper}>
                                                <Picker selectedValue={batchForm.class} onValueChange={v => setBatchForm({ ...batchForm, class: v })}>
                                                    {DISPLAY_YEARS.map(y => <Picker.Item key={y.value} label={y.label} value={y.value} />)}
                                                </Picker>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={styles.label}>Division</Text>
                                            <View style={styles.pickerWrapper}>
                                                <Picker selectedValue={batchForm.division} onValueChange={v => setBatchForm({ ...batchForm, division: v, sub_batch: '' })}>
                                                    {['A', 'B', 'C', 'D'].map(d => <Picker.Item key={d} label={d} value={d} />)}
                                                </Picker>
                                            </View>
                                        </View>
                                    </View>
                                    <Text style={styles.label}>Sub-Batch</Text>
                                    <View style={styles.pickerWrapper}>
                                        <Picker selectedValue={batchForm.sub_batch} onValueChange={v => setBatchForm({ ...batchForm, sub_batch: v })}>
                                            <Picker.Item label="Whole Division" value="" />
                                            <Picker.Item label={`${batchForm.division}1`} value="1" />
                                            <Picker.Item label={`${batchForm.division}2`} value="2" />
                                            <Picker.Item label={`${batchForm.division}3`} value="3" />
                                        </Picker>
                                    </View>
                                    <View style={styles.row}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.label}>Roll No From</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="e.g. CS2401"
                                                value={batchForm.rbt_from}
                                                onChangeText={v => setBatchForm({ ...batchForm, rbt_from: v.toUpperCase() })}
                                                onFocus={() => setActiveInput('from')}
                                                onBlur={() => setTimeout(() => setActiveInput(null), 500)}
                                            />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={styles.label}>Roll No To</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="e.g. CS2420"
                                                value={batchForm.rbt_to}
                                                onChangeText={v => setBatchForm({ ...batchForm, rbt_to: v.toUpperCase() })}
                                                onFocus={() => setActiveInput('to')}
                                                onBlur={() => setTimeout(() => setActiveInput(null), 500)}
                                            />
                                        </View>
                                    </View>
                                    {rbtSuggestions.length > 0 && activeInput && (
                                        <View style={styles.suggestionsBox}>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                <View style={styles.suggestionsGrid}>
                                                    {rbtSuggestions.map((s, idx) => (
                                                        <TouchableOpacity key={idx} style={styles.suggestionChip} onPress={() => {
                                                            if (activeInput === 'from') {
                                                                setBatchForm({ ...batchForm, rbt_from: s.roll });
                                                            } else {
                                                                setBatchForm({ ...batchForm, rbt_to: s.roll });
                                                            }
                                                            setRbtSuggestions([]);
                                                            setActiveInput(null);
                                                        }}>
                                                            <View>
                                                                <Text style={styles.suggestionText}>{s.roll}</Text>
                                                                <Text style={styles.suggestionSubText} numberOfLines={1}>{s.name}</Text>
                                                            </View>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </ScrollView>
                                        </View>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Text style={styles.label}>Select GFM Faculty</Text>
                                    <View style={styles.pickerWrapper}>
                                        <Picker selectedValue={selectedTeacher} onValueChange={setSelectedTeacher}>
                                            <Picker.Item label="Select Teacher" value="" />
                                            {teachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id} />)}
                                        </Picker>
                                    </View>

                                    {selectedTeacher && allocations.find(a => a.teacher_id === selectedTeacher) && (
                                        <View style={{ backgroundColor: '#FFF3CD', padding: 12, borderRadius: 8, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#FFC107' }}>
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#856404', marginBottom: 4 }}>⚠️ Current Allocation</Text>
                                            <Text style={{ fontSize: 11, color: '#856404' }}>
                                                {allocations.find(a => a.teacher_id === selectedTeacher)?.batch_name}
                                            </Text>
                                            <Text style={{ fontSize: 10, color: '#856404', marginTop: 4, fontStyle: 'italic' }}>Assigning a new batch will replace this allocation</Text>
                                        </View>
                                    )}

                                    <Text style={styles.label}>Select Defined Batch</Text>
                                    <View style={styles.pickerWrapper}>
                                        <Picker selectedValue={selectedBatchId} onValueChange={setSelectedBatchId}>
                                            <Picker.Item label="Select Batch" value="" />
                                            {batchDefinitions.map(b => (
                                                <Picker.Item
                                                    key={b.id}
                                                    label={`${b.division}${b.sub_batch || ''} (${b.rbt_from}-${b.rbt_to}) - ${getFullYearName(b.class)}`}
                                                    value={b.id}
                                                />
                                            ))}
                                        </Picker>
                                    </View>
                                </>
                            )}
                            <View style={styles.btnRow}>
                                <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.btnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.btn, styles.saveBtn]}
                                    onPress={modalType === 'batch' ? handleSaveBatch : handleSaveAssignment}
                                >
                                    <Text style={[styles.btnText, { color: '#fff' }]}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f7fe' },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#eceef2'
    },
    backBtn: { padding: 5 },
    title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
    content: { padding: 15 },
    sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    stepBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginRight: 12 },
    stepText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, flex: 1 },
    miniAddBtn: { backgroundColor: COLORS.primary, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    sectionDesc: { fontSize: 13, color: COLORS.textLight, marginBottom: 15 },
    listArea: { backgroundColor: '#f8f9fc', borderRadius: 12, padding: 5 },
    listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginVertical: 5, borderWidth: 1, borderColor: '#eceef2' },
    itemTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
    itemSubText: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
    rbtRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
    itemRbt: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
    emptyText: { textAlign: 'center', color: COLORS.textLight, padding: 20, fontSize: 13 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', padding: 25, borderRadius: 20, maxHeight: '90%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: COLORS.primary },
    label: { marginBottom: 6, color: COLORS.text, fontWeight: '600', fontSize: 14 },
    pickerWrapper: { borderWidth: 1, borderColor: '#eceef2', borderRadius: 12, marginBottom: 18, height: 52, justifyContent: 'center', backgroundColor: '#fcfdfe' },
    input: { borderWidth: 1.5, borderColor: '#eceef2', borderRadius: 12, padding: 12, marginBottom: 18, height: 52, backgroundColor: '#fcfdfe', fontSize: 14 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    suggestionsBox: { backgroundColor: '#f0f4ff', padding: 12, borderRadius: 12, marginBottom: 18 },
    suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    suggestionChip: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary },
    suggestionText: { fontSize: 12, color: COLORS.primary, fontWeight: 'bold' },
    suggestionSubText: { fontSize: 10, color: COLORS.textLight },
    btnRow: { flexDirection: 'row', marginTop: 15, gap: 12 },
    btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
    cancelBtn: { backgroundColor: '#f0f2f5' },
    saveBtn: { backgroundColor: COLORS.primary },
    btnText: { fontWeight: 'bold', fontSize: 15, color: COLORS.text },
});

export default ManageAllocations;
