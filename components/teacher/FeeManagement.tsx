import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker'; // Original used Picker
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { getFullYearName } from '../../constants/Mappings';
import { getFeePaymentsByFilter } from '../../storage/sqlite';
import { styles } from './dashboard.styles';

export const FeeManagement = ({ students, filters, handleVerify }: any) => {
    const [stats, setStats] = useState<any>(null);
    const [feeData, setFeeData] = useState<any[]>([]);
    const [feeStatusFilter, setFeeStatusFilter] = useState<'All' | 'Paid' | 'Not Paid / Remaining'>('All');
    const [yearFilter, setYearFilter] = useState('All');

    const isWeb = Platform.OS === 'web';

    useEffect(() => {
        if (filters) {
            loadFeeData();
        }
    }, [filters]);

    const loadFeeData = async () => {
        if (!filters) return;

        // Fetch department-level data
        const rawFeeData = await getFeePaymentsByFilter(filters.dept, filters.year, filters.div);

        // Create PRN set for O(1) lookup of assigned students
        const assignedPrns = new Set(students.map((s: any) => s.prn));

        // Filter: Keep only students assigned to this teacher
        const filtered = rawFeeData.filter(f => assignedPrns.has(f.prn));
        setFeeData(filtered);

        // Recalculate stats locally for assigned students only
        let studentsWithRemaining = 0;
        let totalRemainingAmount = 0;

        filtered.forEach(f => {
            if ((f.lastBalance || 0) > 0) {
                studentsWithRemaining++;
                totalRemainingAmount += f.lastBalance;
            }
        });

        setStats({
            totalStudents: filtered.length,
            studentsWithRemaining,
            totalRemainingAmount
        });
    };

    const filteredFeeData = feeData.filter(f => {
        if (yearFilter !== 'All' && f.yearOfStudy !== yearFilter) return false;
        if (feeStatusFilter === 'All') return true;
        if (feeStatusFilter === 'Paid') return (f.lastBalance || 0) <= 0;
        if (feeStatusFilter === 'Not Paid / Remaining') return (f.lastBalance || 0) > 0;
        return true;
    });

    const exportFeeCSV = (onlyDefaulters = false) => {
        let csv = 'PRN,Name,Year,Total Fee,Paid,Balance,Receipt Link\n';
        const dataToExport = onlyDefaulters
            ? feeData.filter(f => (f.lastBalance || 0) > 0)
            : filteredFeeData;

        dataToExport.forEach(f => {
            csv += `${f.prn},"${f.fullName}","${getFullYearName(f.yearOfStudy)}",${f.totalFee || 0},${f.paidAmount || 0},${f.lastBalance || 0},"${f.receiptUri || ''}"\n`;
        });

        if (isWeb) {
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${onlyDefaulters ? 'Defaulters' : 'Fee'}_Report_${filters.dept}.csv`;
            a.click();
        } else {
            Alert.alert('Export', 'CSV Exported (Simulation)');
        }
    };

    return (
        <View>
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Total Students</Text>
                    <Text style={styles.statValue}>{stats?.totalStudents || 0}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Defaulters</Text>
                    <Text style={[styles.statValue, { color: COLORS.error }]}>{stats?.studentsWithRemaining || 0}</Text>
                </View>
                <View style={[styles.statCard, { flex: 1.5 }]}>
                    <Text style={styles.statLabel}>Total Outstanding</Text>
                    <Text style={styles.statValue}>₹{stats?.totalRemainingAmount || 0}</Text>
                </View>
            </View>

            <View style={styles.moduleCard}>
                <View style={styles.moduleHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                        <Text style={styles.moduleTitle}>Fee Management</Text>
                        <View style={[styles.pickerWrapper, { width: 130 }]}>
                            <Picker
                                selectedValue={yearFilter}
                                onValueChange={setYearFilter}
                                style={styles.picker}
                            >
                                <Picker.Item label="All Years" value="All" />
                                <Picker.Item label="First Year" value="First Year" />
                                <Picker.Item label="Second Year" value="Second Year" />
                                <Picker.Item label="Third Year" value="Third Year" />
                                <Picker.Item label="Final Year" value="Final Year" />
                            </Picker>
                        </View>
                        <View style={[styles.pickerWrapper, { width: 150 }]}>
                            <Picker
                                selectedValue={feeStatusFilter}
                                onValueChange={setFeeStatusFilter}
                                style={styles.picker}
                            >
                                <Picker.Item label="All Status" value="All" />
                                <Picker.Item label="Paid" value="Paid" />
                                <Picker.Item label="Not Paid" value="Not Paid / Remaining" />
                            </Picker>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => exportFeeCSV(false)}>
                            <Ionicons name="download-outline" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>Export All CSV</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.error }]} onPress={() => exportFeeCSV(true)}>
                            <Ionicons name="warning-outline" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>Defaulters CSV</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <ScrollView horizontal>
                    <View style={styles.table}>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                            <Text style={[styles.tableCell, { width: 100 }]}>PRN</Text>
                            <Text style={[styles.tableCell, { width: 150 }]}>Name</Text>
                            <Text style={[styles.tableCell, { width: 80 }]}>Year</Text>
                            <Text style={[styles.tableCell, { width: 80 }]}>Total</Text>
                            <Text style={[styles.tableCell, { width: 80 }]}>Paid</Text>
                            <Text style={[styles.tableCell, { width: 80 }]}>Balance</Text>
                            <Text style={[styles.tableCell, { width: 80 }]}>Status</Text>
                            <Text style={[styles.tableCell, { width: 120 }]}>Actions</Text>
                        </View>
                        {filteredFeeData.map((f: any) => (
                            <View key={f.prn} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { width: 100 }]}>{f.prn}</Text>
                                <Text style={[styles.tableCell, { width: 150 }]}>{f.fullName}</Text>
                                <Text style={[styles.tableCell, { width: 80 }]}>{getFullYearName(f.yearOfStudy)}</Text>
                                <Text style={[styles.tableCell, { width: 80 }]}>₹{f.totalFee || 0}</Text>
                                <Text style={[styles.tableCell, { width: 80, color: COLORS.success }]}>₹{f.paidAmount || 0}</Text>
                                <Text style={[styles.tableCell, { width: 80, color: (f.lastBalance || 0) > 0 ? COLORS.error : COLORS.success }]}>₹{f.lastBalance || 0}</Text>
                                <Text style={[styles.tableCell, { width: 80, color: (f.lastBalance || 0) > 0 ? COLORS.warning : COLORS.success }]}>
                                    {(f.lastBalance || 0) > 0 ? (f.paidAmount > 0 ? 'Remaining' : 'Not Paid') : (f.totalFee > 0 ? 'Paid' : 'Not Paid')}
                                </Text>
                                <View style={{ width: 120, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                                    {f.receiptUri && (
                                        <TouchableOpacity onPress={() => Alert.alert('Receipt', 'Viewing receipt: ' + f.receiptUri)}>
                                            <Ionicons name="receipt-outline" size={20} color={COLORS.secondary} />
                                        </TouchableOpacity>
                                    )}
                                    {f.verificationStatus !== 'Verified' ? (
                                        <TouchableOpacity onPress={() => handleVerify('fee_payments', f.id, 'Verified')}>
                                            <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                                        </TouchableOpacity>
                                    ) : (
                                        <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};
