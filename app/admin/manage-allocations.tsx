import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { BRANCH_MAPPINGS, getFullBranchName, getFullYearName, YEAR_MAPPINGS } from '../../constants/Mappings';
import { supabase } from '../../services/supabase';

const ManageAllocations = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [allocations, setAllocations] = useState<any[]>([]);
    const [batchDefinitions, setBatchDefinitions] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'batch' | 'assignment'>('batch');
    const [students, setStudents] = useState<any[]>([]);
    const [rbtSuggestions, setRbtSuggestions] = useState<string[]>([]);
    const [activeInput, setActiveInput] = useState<'from' | 'to' | null>(null);

    // Batch Form State (Aligned with Database Keys)
    const [batchForm, setBatchForm] = useState({
        department: 'CSE',
        class: 'SE',
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
        if (batchForm.department && batchForm.class && batchForm.division) {
            loadStudentsForSuggestions();
        }
    }, [batchForm.department, batchForm.class, batchForm.division]);

    // Enhanced RBT suggestions
    useEffect(() => {
        const query = (activeInput === 'from' ? batchForm.rbt_from : batchForm.rbt_to).toLowerCase();
        if (query && students.length > 0) {
            const filtered = students
                .filter(s => s.prn && s.prn.toString().toLowerCase().includes(query))
                .map(s => s.prn.toString())
                .slice(0, 5);
            setRbtSuggestions(filtered);
        } else {
            setRbtSuggestions([]);
        }
    }, [batchForm.rbt_from, batchForm.rbt_to, activeInput, students]);

    const loadStudentsForSuggestions = async () => {
        try {
            const { data } = await supabase
                .from('students')
                .select('prn')
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
            Alert.alert('Error', 'RBT range is required');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.from('batch_definitions').insert([batchForm]);
            if (error) throw error;
            Alert.alert('Success', 'Batch defined successfully');
            setModalVisible(false);
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
            const { error } = await supabase.from('teacher_batch_configs').upsert({
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

            if (error) throw error;
            Alert.alert('Success', 'GFM assigned successfully');
            setModalVisible(false);
            loadData();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBatch = async (id: string) => {
        Alert.alert('Delete Batch', 'This will remove the batch definition. Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    const { error } = await supabase.from('batch_definitions').delete().eq('id', id);
                    if (!error) loadData();
                }
            }
        ]);
    };

    const handleDeleteAssignment = async (id: string) => {
        Alert.alert('Remove GFM', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: async () => {
                    const { error } = await supabase.from('teacher_batch_configs').delete().eq('id', id);
                    if (!error) loadData();
                }
            }
        ]);
    };

    const openModal = (type: 'batch' | 'assignment') => {
        setModalType(type);
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
                    <Text style={styles.sectionDesc}>Create sub-batches and RBT ranges for each division.</Text>

                    <View style={styles.listArea}>
                        {batchDefinitions.map(b => (
                            <View key={b.id} style={styles.listItem}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>
                                        {getFullYearName(b.class)} Div {b.division}{b.sub_batch ? `${b.sub_batch}` : ''}
                                    </Text>
                                    <View style={styles.rbtRow}>
                                        <Ionicons name="people" size={14} color={COLORS.primary} />
                                        <Text style={styles.itemRbt}>RBT: {b.rbt_from} - {b.rbt_to}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => handleDeleteBatch(b.id)}>
                                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                                </TouchableOpacity>
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
                        <Text style={styles.modalTitle}>{modalType === 'batch' ? 'Define New Batch' : 'Assign GFM to Batch'}</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {modalType === 'batch' ? (
                                <>
                                    <Text style={styles.label}>Department</Text>
                                    <View style={styles.pickerWrapper}>
                                        <Picker selectedValue={batchForm.department} onValueChange={v => setBatchForm({ ...batchForm, department: v })}>
                                            {Object.keys(BRANCH_MAPPINGS).map(k => <Picker.Item key={k} label={BRANCH_MAPPINGS[k]} value={k} />)}
                                        </Picker>
                                    </View>
                                    <View style={styles.row}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.label}>Year</Text>
                                            <View style={styles.pickerWrapper}>
                                                <Picker selectedValue={batchForm.class} onValueChange={v => setBatchForm({ ...batchForm, class: v })}>
                                                    {Object.keys(YEAR_MAPPINGS).filter(k => k.length == 2).map(k => <Picker.Item key={k} label={YEAR_MAPPINGS[k]} value={k} />)}
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
                                            <Text style={styles.label}>RBT From</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={batchForm.rbt_from}
                                                onChangeText={v => setBatchForm({ ...batchForm, rbt_from: v })}
                                                onFocus={() => setActiveInput('from')}
                                                onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={styles.label}>RBT To</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={batchForm.rbt_to}
                                                onChangeText={v => setBatchForm({ ...batchForm, rbt_to: v })}
                                                onFocus={() => setActiveInput('to')}
                                                onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            />
                                        </View>
                                    </View>
                                    {rbtSuggestions.length > 0 && activeInput && (
                                        <View style={styles.suggestionsBox}>
                                            <View style={styles.suggestionsGrid}>
                                                {rbtSuggestions.map((prn, idx) => (
                                                    <TouchableOpacity key={idx} style={styles.suggestionChip} onPress={() => {
                                                        if (activeInput === 'from') setBatchForm({ ...batchForm, rbt_from: prn });
                                                        else setBatchForm({ ...batchForm, rbt_to: prn });
                                                        setRbtSuggestions([]);
                                                    }}>
                                                        <Text style={styles.suggestionText}>{prn}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
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
    btnRow: { flexDirection: 'row', marginTop: 15, gap: 12 },
    btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
    cancelBtn: { backgroundColor: '#f0f2f5' },
    saveBtn: { backgroundColor: COLORS.primary },
    btnText: { fontWeight: 'bold', fontSize: 15, color: COLORS.text },
});

export default ManageAllocations;
