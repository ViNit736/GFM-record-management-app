import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { DISPLAY_YEARS } from '../../constants/Mappings';
import { getSession } from '../../services/session.service';
import {
    getAllBatchConfigsInContext,
    getStudentsByRbtRange,
    getTeacherBatchConfig,
    saveTeacherBatchConfig,
    Student,
    TeacherBatchConfig
} from '../../storage/sqlite';
import { styles } from './dashboard.styles';

export const BatchConfigManagement = ({ loadData, yearsOfStudy }: { loadData: () => void, yearsOfStudy: string[] }) => {
    const [config, setConfig] = useState<TeacherBatchConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewStudents, setPreviewStudents] = useState<Student[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    useEffect(() => {
        if (config?.rbtFrom && config?.rbtTo && config.rbtFrom.length >= 2 && config.rbtTo.length >= 2) {
            loadPreview();
        } else {
            setPreviewStudents([]);
        }
    }, [config?.rbtFrom, config?.rbtTo, config?.division, config?.class, config?.department]);

    const loadPreview = async () => {
        setPreviewLoading(true);
        try {
            const students = await getStudentsByRbtRange(
                config!.department,
                config!.class,
                config!.division,
                config!.rbtFrom,
                config!.rbtTo
            );
            setPreviewStudents(students);
        } catch (e) {
            console.error(e);
        } finally {
            setPreviewLoading(false);
        }
    };

    const fetchConfig = async () => {
        const session = await getSession();
        if (!session) return;
        const data = await getTeacherBatchConfig(session.id);
        if (data) setConfig(data);
        else {
            setConfig({
                teacherId: session.id,
                academicYear: '2025-26',
                department: session.department || 'Computer Engineering',
                class: 'First Year',
                division: 'A',
                batchName: 'B1',
                rbtFrom: '',
                rbtTo: '',
                status: 'Pending'
            });
        }
        setLoading(false);
    };

    const suggestNextRange = async () => {
        if (!config) return;
        setPreviewLoading(true);
        try {
            const batches = await getAllBatchConfigsInContext(config.department, config.class, config.division);

            let nextStart = 1;
            if (batches.length > 0) {
                const maxTo = Math.max(...batches.map(b => {
                    const match = b.rbtTo.match(/\d+$/);
                    let val = match ? parseInt(match[0]) : 0;
                    if (val > 1000) val = val % 1000; // Handle CS24XX
                    if (val > 100) val = val % 100; // Handle CS24XX if XX is roll
                    return val;
                }));
                nextStart = maxTo + 1;
            }

            // Generate Prefix based on new standard
            const yearPart = config.academicYear.substring(2, 4); // 2025 -> 25? Wait
            // Usually academic year 2024-25 means Year 24.
            const yr = config.academicYear.split('-')[0].slice(-2);
            let prefix = `CS${yr}`;

            const fromStr = `${prefix}${String(nextStart).padStart(2, '0')}`;
            const toStr = `${prefix}${String(nextStart + 19).padStart(2, '0')}`;

            setConfig({
                ...config,
                rbtFrom: fromStr,
                rbtTo: toStr
            });
            Alert.alert('Suggestion Applied', `Suggested range: ${fromStr} to ${toStr}`);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to generate suggestion');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleSave = async () => {
        if (!config?.rbtFrom || !config?.rbtTo) {
            Alert.alert('Error', 'Please enter Roll range');
            return;
        }

        if (config.status === 'Approved') {
            const confirm = await new Promise((resolve) => {
                Alert.alert(
                    'Update Configuration',
                    'Modifying your batch configuration will reset its status to "Pending" and require Admin approval again. Continue?',
                    [
                        { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                        { text: 'Update', onPress: () => resolve(true) }
                    ]
                );
            });
            if (!confirm) return;
        }

        setSaving(true);
        try {
            await saveTeacherBatchConfig(config);
            fetchConfig();
            Alert.alert('Success', 'Batch configuration submitted!');
            loadData();
        } catch (e: any) {
            Alert.alert('Error', `Failed to save configuration: ${e.message || JSON.stringify(e)}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <ActivityIndicator size="large" color={COLORS.primary} />;

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'Approved': return COLORS.success;
            case 'Rejected': return COLORS.error;
            default: return COLORS.warning;
        }
    };

    return (
        <View style={styles.moduleCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                    <Text style={styles.moduleTitle}>My Batch Details</Text>
                    <Text style={[styles.helperText, { marginTop: 5 }]}>Configure your assigned Roll No range for attendance.</Text>
                </View>
                <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: getStatusColor(config?.status) + '20', borderWidth: 1, borderColor: getStatusColor(config?.status) }}>
                    <Text style={{ color: getStatusColor(config?.status), fontWeight: 'bold', fontSize: 12 }}>
                        {config?.status || 'Pending'}
                    </Text>
                </View>
            </View>

            {config?.status === 'Rejected' && config.rejectionReason && (
                <View style={{ backgroundColor: COLORS.error + '15', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: COLORS.error + '50' }}>
                    <Text style={{ color: COLORS.error, fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>Rejection Reason:</Text>
                    <Text style={{ color: COLORS.error, fontSize: 13 }}>{config.rejectionReason}</Text>
                </View>
            )}

            <View style={{ marginTop: 20 }}>
                <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.filterLabel}>Academic Year</Text>
                        <View style={[styles.pickerWrapper, { width: '100%' }]}>
                            <Picker selectedValue={config?.academicYear} onValueChange={v => setConfig({ ...config!, academicYear: v })}>
                                <Picker.Item label="2025-26" value="2025-26" />
                                <Picker.Item label="2024-25" value="2024-25" />
                            </Picker>
                        </View>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.filterLabel}>Class</Text>
                        <View style={[styles.pickerWrapper, { width: '100%' }]}>
                            <Picker selectedValue={config?.class} onValueChange={v => setConfig({ ...config!, class: v })}>
                                {DISPLAY_YEARS.map(year => (
                                    <Picker.Item key={year.value} label={year.label} value={year.value} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                </View>

                <View style={[styles.row, { marginTop: 15 }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.filterLabel}>Division</Text>
                        <View style={[styles.pickerWrapper, { width: '100%' }]}>
                            <Picker selectedValue={config?.division} onValueChange={v => setConfig({ ...config!, division: v })}>
                                <Picker.Item label="A" value="A" />
                                <Picker.Item label="A1" value="A1" />
                                <Picker.Item label="A2" value="A2" />
                                <Picker.Item label="A3" value="A3" />
                                <Picker.Item label="B" value="B" />
                                <Picker.Item label="B1" value="B1" />
                                <Picker.Item label="B2" value="B2" />
                                <Picker.Item label="B3" value="B3" />
                                <Picker.Item label="C" value="C" />
                                <Picker.Item label="C1" value="C1" />
                                <Picker.Item label="C2" value="C2" />
                                <Picker.Item label="C3" value="C3" />
                            </Picker>
                        </View>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.filterLabel}>Batch Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. B1, B2"
                            value={config?.batchName}
                            onChangeText={t => setConfig({ ...config!, batchName: t })}
                        />
                    </View>
                </View>

                <View style={[styles.row, { marginTop: 15 }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.filterLabel}>Roll No Range From</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. CS2401"
                            value={config?.rbtFrom}
                            onChangeText={t => setConfig({ ...config!, rbtFrom: t.toUpperCase() })}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.filterLabel}>Roll No Range To</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. CS2420"
                            value={config?.rbtTo}
                            onChangeText={t => setConfig({ ...config!, rbtTo: t.toUpperCase() })}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '10', padding: 8, borderRadius: 8, marginTop: 15, alignSelf: 'flex-start' }}
                    onPress={suggestNextRange}
                >
                    <Ionicons name="sparkles-outline" size={16} color={COLORS.primary} />
                    <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 12, marginLeft: 6 }}>Suggest Next Available Range</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.saveBtn, { padding: 15, borderRadius: 10, marginTop: 20, opacity: saving ? 0.7 : 1 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Configuration</Text>}
                </TouchableOpacity>

                {/* Batch Preview */}
                <View style={{ marginTop: 30, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 }}>
                    <Text style={[styles.moduleTitle, { fontSize: 16 }]}>Batch Preview ({previewStudents.length} Students)</Text>
                    {previewLoading ? (
                        <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginTop: 20 }} />
                    ) : previewStudents.length > 0 ? (
                        <View style={[styles.table, { marginTop: 10 }]}>
                            <View style={[styles.tableRow, styles.tableHeader]}>
                                <Text style={[styles.tableCell, { flex: 0.8 }]}>Roll No</Text>
                                <Text style={[styles.tableCell, { flex: 1.2 }]}>PRN</Text>
                                <Text style={[styles.tableCell, { flex: 2 }]}>Name</Text>
                            </View>
                            {previewStudents.slice(0, 10).map(s => (
                                <View key={s.prn} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, { flex: 0.8 }]}>{s.rollNo}</Text>
                                    <Text style={[styles.tableCell, { flex: 1.2 }]}>{s.prn}</Text>
                                    <Text style={[styles.tableCell, { flex: 2 }]}>{s.fullName}</Text>
                                </View>
                            ))}
                            {previewStudents.length > 10 && (
                                <Text style={{ textAlign: 'center', padding: 10, color: COLORS.textLight, fontSize: 12 }}>
                                    + {previewStudents.length - 10} more students
                                </Text>
                            )}
                        </View>
                    ) : (
                        <View style={{ padding: 30, alignItems: 'center' }}>
                            <Ionicons name="people-outline" size={32} color={COLORS.textLight} />
                            <Text style={{ color: COLORS.textLight, marginTop: 10 }}>No students found in this range.</Text>
                            <Text style={{ color: COLORS.textLight, fontSize: 12, textAlign: 'center' }}>
                                Check if Year, Department and Division match your student data.
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};
