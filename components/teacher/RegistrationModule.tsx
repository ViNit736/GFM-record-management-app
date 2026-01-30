import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Papa from 'papaparse';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { BRANCH_MAPPINGS, getFullYearName, YEAR_MAPPINGS } from '../../constants/Mappings';
import { getAllStudents, getDistinctYearsOfStudy, saveStudent, Student } from '../../storage/sqlite';

const isWeb = Platform.OS === 'web';

export const RegistrationModule = () => {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importPreview, setImportPreview] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [newStudent, setNewStudent] = useState({
        prn: '',
        fullName: '',
        email: '',
        branch: 'CSE',
        yearOfStudy: 'FE',
        division: 'A'
    });

    const [yearsOfStudy, setYearsOfStudy] = useState<string[]>([]);

    useEffect(() => {
        loadData();
        loadMetadata();
    }, []);

    const loadMetadata = async () => {
        const years = await getDistinctYearsOfStudy();
        setYearsOfStudy(years);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const studentData = await getAllStudents();
            setStudents(studentData);
        } catch (error) {
            console.error('Error loading data:', error);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddStudent = async () => {
        if (!newStudent.prn || !newStudent.fullName || !newStudent.email) {
            Alert.alert('Error', 'Please enter PRN, Full Name and Email');
            return;
        }
        try {
            await saveStudent({
                ...newStudent,
                gfmId: '',
                gfmName: ''
            });
            setModalVisible(false);
            setNewStudent({
                prn: '',
                fullName: '',
                email: '',
                branch: 'CSE',
                yearOfStudy: 'FE',
                division: 'A'
            });
            loadData();
            Alert.alert('Success', 'Student added successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to add student. Ensure PRN is unique.');
        }
    };

    const handleFileSelect = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const parsedStudents = results.data.map((row: any) => ({
                        fullName: row['Full Name'] || row['fullName'] || row['Name'] || row['name'] || '',
                        email: row['Email'] || row['email'] || row['Email ID'] || row['EmailID'] || '',
                        prn: String(row['PRN'] || row['prn'] || row['Roll No'] || row['rollno'] || row['RollNo'] || ''),
                        branch: row['Branch'] || row['branch'] || row['Department'] || row['department'] || 'CSE',
                        yearOfStudy: row['Year'] || row['year'] || row['Year of Study'] || row['yearOfStudy'] || 'FE',
                        division: row['Division'] || row['division'] || row['Div'] || row['div'] || 'A'
                    })).filter((s: any) => s.fullName && s.prn);

                    setImportPreview(parsedStudents);
                    setImportModalVisible(true);
                    setImporting(false);
                },
                error: () => {
                    Alert.alert('Error', 'Failed to read CSV file');
                    setImporting(false);
                }
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to read CSV file');
            setImporting(false);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleImportStudents = async () => {
        if (importPreview.length === 0) {
            Alert.alert('Error', 'No students to import');
            return;
        }

        setImporting(true);
        let successCount = 0;
        let failCount = 0;

        for (const student of importPreview) {
            try {
                await saveStudent({
                    ...student,
                    gfmId: '',
                    gfmName: ''
                });
                successCount++;
            } catch (e) {
                failCount++;
            }
        }

        setImporting(false);
        setImportModalVisible(false);
        setImportPreview([]);
        loadData();
        Alert.alert('Import Complete', `Successfully added ${successCount} students. ${failCount > 0 ? `${failCount} failed (duplicate PRN).` : ''}`);
    };

    const renderStudentItem = ({ item }: { item: Student }) => (
        <View style={styles.studentCard}>
            <View style={styles.cardAccent} />
            <View style={styles.cardInner}>
                <View style={styles.studentTop}>
                    <View style={styles.avatarBox}>
                        <Text style={styles.avatarTxt}>{item.fullName.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>{item.fullName}</Text>
                        <Text style={styles.studentPrn}>PRN: {item.prn}</Text>
                    </View>
                    <TouchableOpacity style={styles.optionsBtn}>
                        <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textLight} />
                    </TouchableOpacity>
                </View>

                <View style={styles.detailsGrid}>
                    <View style={styles.detailItem}>
                        <Ionicons name="school-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.detailText}>{getFullYearName(item.yearOfStudy)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="grid-outline" size={14} color={COLORS.secondary} />
                        <Text style={styles.detailText}>Div {item.division}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="mail-outline" size={14} color={COLORS.accent} />
                        <Text style={styles.detailText} numberOfLines={1}>{item.email}</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.mainContainer}>
            <View style={styles.glassHeader}>
                <View>
                    <Text style={styles.headerTitle}>Student Registry</Text>
                    <Text style={styles.headerSubtitle}>Manage enrollment database</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    {isWeb && (
                        <TouchableOpacity onPress={() => fileInputRef.current?.click()} style={styles.importBtn}>
                            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                            <Text style={styles.importBtnText}>Bulk Import</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {isWeb && (
                <input
                    type="file"
                    ref={fileInputRef as any}
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
            )}

            {loading ? (
                <View style={styles.loaderBox}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loaderTxt}>Syncing Registry...</Text>
                </View>
            ) : (
                <FlatList
                    data={students}
                    keyExtractor={(item) => item.prn}
                    renderItem={renderStudentItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Ionicons name="people-outline" size={64} color={COLORS.textLight} />
                            <Text style={styles.emptyText}>No students registered yet</Text>
                            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.emptyAddBtn}>
                                <Text style={styles.emptyAddTxt}>Register First Student</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add New Student</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Full Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Student's Full Name"
                            value={newStudent.fullName}
                            onChangeText={t => setNewStudent({ ...newStudent, fullName: t })}
                        />

                        <Text style={styles.label}>Email ID *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="student@email.com"
                            value={newStudent.email}
                            onChangeText={t => setNewStudent({ ...newStudent, email: t })}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <Text style={styles.label}>PRN *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Unique PRN Number"
                            value={newStudent.prn}
                            onChangeText={t => setNewStudent({ ...newStudent, prn: t })}
                            autoCapitalize="characters"
                        />

                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Branch</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={newStudent.branch}
                                        onValueChange={v => setNewStudent({ ...newStudent, branch: v })}
                                    >
                                        {Object.keys(BRANCH_MAPPINGS).map(key => (
                                            <Picker.Item key={key} label={BRANCH_MAPPINGS[key]} value={key} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.label}>Year</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={newStudent.yearOfStudy}
                                        onValueChange={v => setNewStudent({ ...newStudent, yearOfStudy: v })}
                                    >
                                        {Object.keys(YEAR_MAPPINGS).filter(k => k.length === 2).map(year => (
                                            <Picker.Item key={year} label={YEAR_MAPPINGS[year]} value={year} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                        </View>

                        <Text style={styles.label}>Division</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={newStudent.division}
                                onValueChange={v => setNewStudent({ ...newStudent, division: v })}
                            >
                                <Picker.Item label="A" value="A" />
                                <Picker.Item label="B" value="B" />
                                <Picker.Item label="C" value="C" />
                            </Picker>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.modalBtn, styles.cancelBtn]}>
                                <Text style={styles.modalBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleAddStudent} style={[styles.modalBtn, styles.saveBtn]}>
                                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add Student</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#FAFBFF' },
    glassHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#EDF0F5',
        marginBottom: 10
    },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
    importBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.secondary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    importBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
    addBtn: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    listContent: { padding: 20, paddingBottom: 100 },
    studentCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        marginBottom: 15,
        flexDirection: 'row',
        overflow: 'hidden',
        elevation: 2,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#F0F2F5',
    },
    cardAccent: { width: 5, backgroundColor: COLORS.primary },
    cardInner: { flex: 1, padding: 16 },
    studentTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    avatarBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarTxt: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 },
    studentName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 2 },
    studentPrn: { fontSize: 12, color: COLORS.textLight },
    optionsBtn: { padding: 4 },
    detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8F9FE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    detailText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
    loaderBox: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    loaderTxt: { marginTop: 15, color: COLORS.textLight, fontSize: 13 },
    emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { marginTop: 20, fontSize: 14, color: COLORS.textLight, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
    emptyAddBtn: { marginTop: 25, backgroundColor: COLORS.primary + '10', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    emptyAddTxt: { color: COLORS.primary, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
    label: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: '#F5F6FA', borderRadius: 16, padding: 14, fontSize: 15, marginBottom: 16, borderWidth: 1, borderColor: '#EDF0F5' },
    row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    pickerContainer: { backgroundColor: '#F5F6FA', borderRadius: 16, borderWidth: 1, borderColor: '#EDF0F5', overflow: 'hidden' },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
    modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
    cancelBtn: { backgroundColor: '#F5F6FA' },
    saveBtn: { backgroundColor: COLORS.primary },
    modalBtnText: { fontWeight: 'bold', fontSize: 16, color: COLORS.textSecondary },
});
