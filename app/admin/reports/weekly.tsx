import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { supabase } from '../../../services/supabase';

const WeeklyReport = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<any[]>([]);
    const [allLogs, setAllLogs] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');

    useEffect(() => {
        loadReport();
    }, [dateRange]);

    const getDateRange = () => {
        const now = new Date();
        let startDate = new Date();

        switch (dateRange) {
            case 'today':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(now.getMonth() - 1);
                break;
        }

        return {
            start: startDate.toISOString(),
            end: now.toISOString()
        };
    };

    const getDateRangeLabel = () => {
        const { start, end } = getDateRange();
        const startDate = new Date(start);
        const endDate = new Date(end);

        return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    };

    const loadReport = async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange();

            const { data: commLogs, error } = await supabase
                .from('communication_logs')
                .select(`
                    *,
                    profiles:gfm_id(full_name, prn)
                `)
                .gte('created_at', start)
                .lte('created_at', end)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Group by GFM
            const gfmStats: Record<string, any> = {};

            (commLogs || []).forEach((log: any) => {
                const gfmName = log.profiles?.full_name || 'Unknown';
                if (!gfmStats[gfmName]) {
                    gfmStats[gfmName] = { calls: 0, whatsapp: 0, name: gfmName };
                }
                if (log.communication_type === 'call') gfmStats[gfmName].calls++;
                else gfmStats[gfmName].whatsapp++;
            });

            setReportData(Object.values(gfmStats));
            setAllLogs(commLogs || []);

        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Activity Report</Text>
            </View>

            <View style={styles.filterBar}>
                <Text style={styles.filterLabel}>Period:</Text>
                <View style={styles.filterButtons}>
                    <TouchableOpacity
                        style={[styles.filterBtn, dateRange === 'today' && styles.filterBtnActive]}
                        onPress={() => setDateRange('today')}
                    >
                        <Text style={[styles.filterBtnText, dateRange === 'today' && styles.filterBtnTextActive]}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterBtn, dateRange === 'week' && styles.filterBtnActive]}
                        onPress={() => setDateRange('week')}
                    >
                        <Text style={[styles.filterBtnText, dateRange === 'week' && styles.filterBtnTextActive]}>Last 7 Days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterBtn, dateRange === 'month' && styles.filterBtnActive]}
                        onPress={() => setDateRange('month')}
                    >
                        <Text style={[styles.filterBtnText, dateRange === 'month' && styles.filterBtnTextActive]}>Last 30 Days</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.dateRangeInfo}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                <Text style={styles.dateRangeText}>{getDateRangeLabel()}</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
            ) : (
                <ScrollView style={styles.content}>
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>GFM Communication Summary</Text>
                        <View style={styles.table}>
                            <View style={[styles.row, styles.headerRow]}>
                                <Text style={[styles.cell, { flex: 2 }]}>GFM Name</Text>
                                <Text style={[styles.cell, { flex: 1 }]}>Calls</Text>
                                <Text style={[styles.cell, { flex: 1 }]}>WhatsApp</Text>
                                <Text style={[styles.cell, { flex: 1 }]}>Total</Text>
                            </View>
                            {reportData.map((item, idx) => (
                                <View key={idx} style={styles.row}>
                                    <Text style={[styles.cell, { flex: 2 }]}>{item.name}</Text>
                                    <Text style={[styles.cell, { flex: 1 }]}>{item.calls}</Text>
                                    <Text style={[styles.cell, { flex: 1 }]}>{item.whatsapp}</Text>
                                    <Text style={[styles.cell, { flex: 1, fontWeight: 'bold', color: COLORS.primary }]}>{item.calls + item.whatsapp}</Text>
                                </View>
                            ))}
                            {reportData.length === 0 && (
                                <View style={{ padding: 20 }}>
                                    <Text style={{ textAlign: 'center', color: COLORS.textLight }}>No activity found for this period.</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Detailed Activity Logs</Text>
                        {allLogs.map((log: any, idx: number) => (
                            <View key={log.id} style={styles.logItem}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <Text style={styles.logStudent}>{log.student_prn}</Text>
                                    <Text style={styles.logDate}>{new Date(log.created_at).toLocaleDateString()}</Text>
                                </View>
                                <Text style={styles.logGfm}>GFM: {log.profiles?.full_name}</Text>
                                <Text style={styles.logReason}>Reason: <Text style={{ fontWeight: 'bold' }}>{log.reason || 'N/A'}</Text></Text>
                                {log.custom_description ? (
                                    <Text style={styles.logNotes}>Notes: {log.custom_description}</Text>
                                ) : null}
                                {log.report_url ? (
                                    <TouchableOpacity
                                        style={styles.linkContainer}
                                        onPress={() => Linking.openURL(log.report_url)}
                                    >
                                        <Ionicons name="link" size={14} color={COLORS.primary} />
                                        <Text style={styles.linkText}>View Report</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ))}
                        {allLogs.length === 0 && (
                            <Text style={{ textAlign: 'center', color: COLORS.textLight }}>No detailed logs available.</Text>
                        )}
                    </View>
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
    },
    backBtn: { marginRight: 15 },
    title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
    content: { padding: 20 },
    filterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    filterLabel: { marginRight: 10, fontSize: 14, fontWeight: 'bold', color: COLORS.text },
    filterButtons: { flexDirection: 'row', gap: 8, flex: 1 },
    filterBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#ddd'
    },
    filterBtnActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary
    },
    filterBtnText: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
    filterBtnTextActive: { color: '#fff' },
    dateRangeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f0f4ff',
        gap: 8
    },
    dateRangeText: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 20, elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: COLORS.primary },
    table: { borderWidth: 1, borderColor: '#eee', borderRadius: 8 },
    row: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerRow: { backgroundColor: COLORS.secondary + '10' },
    cell: { fontSize: 14, color: COLORS.text },
    logItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    logStudent: { fontWeight: 'bold', fontSize: 15, color: COLORS.text },
    logDate: { fontSize: 12, color: COLORS.textLight },
    logGfm: { fontSize: 13, color: COLORS.secondary, marginTop: 2 },
    logReason: { fontSize: 13, marginTop: 4, color: COLORS.text },
    logNotes: { fontSize: 12, color: COLORS.textLight, marginTop: 2, fontStyle: 'italic' },
    linkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 5,
        backgroundColor: COLORS.primary + '10',
        padding: 5,
        borderRadius: 4,
        alignSelf: 'flex-start'
    },
    linkText: { fontSize: 12, color: COLORS.primary, fontWeight: 'bold' }
});

export default WeeklyReport;
