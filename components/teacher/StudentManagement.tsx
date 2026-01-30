import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { Student } from '../../storage/sqlite';

// Fallback for jsPDF if needed locally or web
// import jsPDF from 'jspdf'; 

export const StudentManagement = ({ students, filters, onViewDetails, onPrint, handleVerify, onCall }: any) => {

    const isWeb = Platform.OS === 'web';

    const exportCSV = () => {
        let csv = 'PRN,Name,Department,Year,Division,Status\n';
        students.forEach((s: any) => {
            csv += `${s.prn},"${s.fullName}","${s.branch}","${s.yearOfStudy}","${s.division}","${s.verificationStatus}"\n`;
        });

        if (isWeb) {
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Student_Report_${filters.dept}.csv`;
            a.click();
        } else {
            Alert.alert('Export', 'CSV Exported (Simulation)');
        }
    };

    const renderMobileCard = (s: Student) => (
        <View key={s.prn} style={styles.mobileCard}>
            <View style={styles.cardTop}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{s.fullName.charAt(0)}</Text>
                </View>
                <View style={styles.cardHeaderInfo}>
                    <Text style={styles.cardName}>{s.fullName}</Text>
                    <Text style={styles.cardPrn}>PRN: {s.prn}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: s.verificationStatus === 'Verified' ? COLORS.success + '15' : COLORS.warning + '15' }]}>
                    <Text style={[styles.statusBadgeText, { color: s.verificationStatus === 'Verified' ? COLORS.success : COLORS.warning }]}>
                        {s.verificationStatus || 'Pending'}
                    </Text>
                </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                    <Ionicons name="grid-outline" size={14} color={COLORS.textLight} />
                    <Text style={styles.infoLabel}>Division: {s.division}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="person-outline" size={14} color={COLORS.textLight} />
                    <Text style={styles.infoLabel}>GFM: {s.gfmName || 'Not Assigned'}</Text>
                </View>
            </View>

            <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => onViewDetails(s)} style={styles.actionIconButton}>
                    <Ionicons name="eye-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.actionLabel}>View</Text>
                </TouchableOpacity>

                {s.verificationStatus !== 'Verified' && (
                    <TouchableOpacity onPress={() => handleVerify('students', s.prn, 'Verified')} style={styles.actionIconButton}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                        <Text style={styles.actionLabel}>Verify</Text>
                    </TouchableOpacity>
                )}

                {onCall && (
                    <TouchableOpacity onPress={() => onCall(s)} style={styles.actionIconButton}>
                        <Ionicons name="call-outline" size={20} color={COLORS.success} />
                        <Text style={styles.actionLabel}>Call</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <View style={localStyles.container}>
            <View style={styles.moduleHeader}>
                <Text style={styles.moduleTitle}>Student Directory</Text>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={exportCSV}>
                    <Ionicons name="download-outline" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>{isWeb ? 'Export CSV' : 'Export'}</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.helperText}>
                Refining {students.length} profile entries
            </Text>

            {isWeb ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.table}>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                            <Text style={[styles.tableCell, { width: 100 }]}>PRN</Text>
                            <Text style={[styles.tableCell, { width: 180 }]}>Name</Text>
                            <Text style={[styles.tableCell, { width: 50 }]}>Div</Text>
                            <Text style={[styles.tableCell, { width: 150 }]}>GFM Name</Text>
                            <Text style={[styles.tableCell, { width: 80 }]}>Status</Text>
                            <Text style={[styles.tableCell, { width: 150 }]}>Actions</Text>
                        </View>
                        {students.map((s: Student) => (
                            <View key={s.prn} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { width: 100 }]}>{s.prn}</Text>
                                <Text style={[styles.tableCell, { width: 180 }]}>{s.fullName}</Text>
                                <Text style={[styles.tableCell, { width: 50 }]}>{s.division}</Text>
                                <Text style={[styles.tableCell, { width: 150, fontStyle: 'italic', fontSize: 13 }]}>{s.gfmName || 'Not Assigned'}</Text>
                                <Text style={[styles.tableCell, { width: 80, color: s.verificationStatus === 'Verified' ? COLORS.success : COLORS.warning }]}>
                                    {s.verificationStatus || 'Pending'}
                                </Text>
                                <View style={{ width: 150, flexDirection: 'row', gap: 15 }}>
                                    <TouchableOpacity onPress={() => onViewDetails(s)}>
                                        <Ionicons name="eye-outline" size={20} color={COLORS.primary} />
                                    </TouchableOpacity>
                                    {s.verificationStatus !== 'Verified' && (
                                        <TouchableOpacity onPress={() => handleVerify('students', s.prn, 'Verified')}>
                                            <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                                        </TouchableOpacity>
                                    )}
                                    {onCall && (
                                        <TouchableOpacity onPress={() => onCall(s)}>
                                            <Ionicons name="call-outline" size={20} color={COLORS.success} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            ) : (
                <View style={localStyles.mobileList}>
                    {students.map(renderMobileCard)}
                </View>
            )}
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 20,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
        marginBottom: 20,
    },
    mobileList: {
        gap: 15,
    },
});

const styles = StyleSheet.create({
    moduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    moduleTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    actionBtnText: { color: '#fff', marginLeft: 8, fontWeight: 'bold', fontSize: 13 },
    helperText: { fontSize: 13, color: COLORS.textLight, marginBottom: 20 },

    // Web Table Styles
    table: { marginTop: 10, width: '100%' },
    tableRow: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F2F5', alignItems: 'center' },
    tableHeader: { backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: '#EDF0F5', borderRadius: 8 },
    tableCell: { fontSize: 13, color: COLORS.text, paddingHorizontal: 10 },

    // Mobile Card Styles
    mobileCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F0F2F5',
        elevation: 2,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatarCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary + '10',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 18 },
    cardHeaderInfo: { flex: 1 },
    cardName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    cardPrn: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusBadgeText: { fontSize: 11, fontWeight: 'bold' },
    cardDivider: { height: 1, backgroundColor: '#F0F2F5', marginVertical: 12 },
    cardBody: { flexDirection: 'row', gap: 20, marginBottom: 15 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    infoLabel: { fontSize: 13, color: COLORS.textSecondary },
    cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F9FAFB', paddingTop: 15, justifyContent: 'space-around' },
    actionIconButton: { alignItems: 'center', gap: 4 },
    actionLabel: { fontSize: 10, color: COLORS.textLight, fontWeight: '600' },
});
