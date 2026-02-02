import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import {
    getAllActivitiesByFilter,
    getAllInternshipsByFilter,
    getFeeAnalytics,
    getFeePaymentsByFilter
} from '../../storage/sqlite';
import { styles } from './dashboard.styles';

export const VerificationItem = ({ icon, label, verified, total, color, bg }: any) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: bg || '#F8FAFC', padding: 12, borderRadius: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>{label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                <Text style={{ fontSize: 11, color: COLORS.textLight }}>Verification Track</Text>
            </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontWeight: '800', fontSize: 14, color }}>{verified} / {total}</Text>
            <Text style={{ fontSize: 10, color: COLORS.textLight, fontWeight: '600' }}>VERIFIED</Text>
        </View>
    </View>
);

export const AnalyticsManagement = ({ students, filters }: any) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>({
        total: 0,
        verified: 0,
        pending: 0,
        deptWise: {},
        feeStats: { total: 0, paid: 0 },
        moduleStats: {
            activities: { total: 0, verified: 0 },
            internships: { total: 0, verified: 0 },
            fees: { total: 0, verified: 0 }
        }
    });

    useEffect(() => {
        if (students && filters) {
            loadAnalytics();
        }
    }, [students, filters]);

    const loadAnalytics = async () => {
        setLoading(true);
        const total = students.length;
        const verified = students.filter((s: any) => s.verificationStatus === 'Verified').length;
        const pending = total - verified;

        const deptWise: Record<string, number> = {};
        students.forEach((s: any) => {
            deptWise[s.branch] = (deptWise[s.branch] || 0) + 1;
        });

        const dept = filters?.dept || 'All';
        const year = filters?.year || 'All';
        const div = filters?.div || 'All';
        const sem = filters?.sem || 'All';
        const activityType = filters?.activityType || 'All';

        const acts = await getAllActivitiesByFilter(dept, year, div, sem, activityType);
        const interns = await getAllInternshipsByFilter(dept, year, div);
        const fees = await getFeePaymentsByFilter(dept, year, div);
        const feeAnalyticsRaw = await getFeeAnalytics(dept, year, div);

        // Filter all data based on authorized student list
        const authorizedPrns = new Set(students.map((s: any) => s.prn));
        const filteredActs = acts.filter((a: any) => authorizedPrns.has(a.prn));
        const filteredInterns = interns.filter((i: any) => authorizedPrns.has(i.prn));
        const filteredFees = fees.filter((f: any) => authorizedPrns.has(f.prn));

        // Fee analytics needs a bit more care since it's a summary object
        // Actually, we can recalculate it from filteredFees or just use the local student count
        const paidAmount = filteredFees.reduce((acc: number, f: any) => acc + (f.amountPaid || 0), 0);
        const studentsPaidCount = filteredFees.filter((f: any) => f.amountPaid > 0).length;
        const totalStudentsInBatch = students.length;

        // Calculate the standard fee for this batch based on students who have already updated their records
        // Many students might have 0 because they haven't uploaded a first receipt.
        const feeCounts: Record<number, number> = {};
        filteredFees.forEach(f => {
            if (f.totalFee > 0) {
                feeCounts[f.totalFee] = (feeCounts[f.totalFee] || 0) + 1;
            }
        });

        let batchStandardFee = 0;
        let maxCount = 0;
        Object.entries(feeCounts).forEach(([fee, count]) => {
            if (count > maxCount) {
                maxCount = count;
                batchStandardFee = Number(fee);
            }
        });

        // The target should reflect the cumulative fees expected from ALL students in the batch
        const totalTarget = filteredFees.reduce((acc: number, f: any) => {
            return acc + (f.totalFee || batchStandardFee);
        }, 0);

        setStats({
            total, verified, pending, deptWise,
            feeStats: {
                total: totalTarget,
                paid: paidAmount,
                studentsPaid: studentsPaidCount,
                studentsTotal: totalStudentsInBatch
            },
            moduleStats: {
                activities: { total: filteredActs.length, verified: filteredActs.filter((a: any) => a.verificationStatus === 'Verified').length },
                internships: { total: filteredInterns.length, verified: filteredInterns.filter((i: any) => i.verificationStatus === 'Verified').length },
                fees: { total: filteredFees.length, verified: filteredFees.filter((f: any) => f.verificationStatus === 'Verified').length }
            }
        });
        setLoading(false);
    };

    if (loading) return <ActivityIndicator size="small" color={COLORS.secondary} />;

    return (
        <View>
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftWidth: 0, backgroundColor: '#EEF2FF', elevation: 0, borderRightWidth: 1, borderRightColor: '#E2E8F0' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="people" size={20} color="#6366F1" />
                        <Text style={[styles.statLabel, { marginBottom: 0 }]}>Total Students</Text>
                    </View>
                    <Text style={[styles.statValue, { marginTop: 10 }]}>{stats.total}</Text>
                </View>
                <View style={[styles.statCard, { borderLeftWidth: 0, backgroundColor: '#F0FDF4', elevation: 0, borderRightWidth: 1, borderRightColor: '#E2E8F0' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                        <Text style={[styles.statLabel, { marginBottom: 0 }]}>Verified</Text>
                    </View>
                    <Text style={[styles.statValue, { color: COLORS.success, marginTop: 10 }]}>{stats.verified}</Text>
                </View>
                <View style={[styles.statCard, { borderLeftWidth: 0, backgroundColor: '#FFF7ED', elevation: 0 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="time" size={20} color={COLORS.warning} />
                        <Text style={[styles.statLabel, { marginBottom: 0 }]}>Pending</Text>
                    </View>
                    <Text style={[styles.statValue, { color: COLORS.warning, marginTop: 10 }]}>{stats.pending}</Text>
                </View>
            </View>

            {/* Fee Collection Card */}
            <View style={[styles.moduleCard, { marginBottom: 15 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 }}>
                    <View style={{ backgroundColor: COLORS.success + '15', padding: 8, borderRadius: 10 }}>
                        <Ionicons name="card" size={22} color={COLORS.success} />
                    </View>
                    <Text style={styles.moduleTitle}>Fee Collection Progress</Text>
                </View>

                <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                        <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.text }}>
                            {stats.feeStats.studentsPaid} / {stats.feeStats.studentsTotal}
                        </Text>
                        <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' }}>Students Paid</Text>
                    </View>

                    <View style={{ width: '100%', height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden', marginTop: 15, marginBottom: 8 }}>
                        <View style={{ height: '100%', backgroundColor: COLORS.success, width: `${(stats.feeStats.studentsPaid / (stats.feeStats.studentsTotal || 1)) * 100}%` }} />
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                        <View>
                            <Text style={{ fontSize: 11, color: COLORS.textLight, fontWeight: '600' }}>COLLECTED</Text>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.success }}>₹{stats.feeStats.paid.toLocaleString()}</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.moduleCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 }}>
                    <View style={{ backgroundColor: COLORS.primary + '15', padding: 8, borderRadius: 10 }}>
                        <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
                    </View>
                    <Text style={styles.moduleTitle}>Verification Status</Text>
                </View>

                <View style={{ gap: 4 }}>
                    <VerificationItem
                        icon="layers"
                        label="Activities"
                        verified={stats.moduleStats.activities.verified}
                        total={stats.moduleStats.activities.total}
                        color={COLORS.secondary}
                        bg="#EEF2FF"
                    />
                    <VerificationItem
                        icon="briefcase"
                        label="Internships"
                        verified={stats.moduleStats.internships.verified}
                        total={stats.moduleStats.internships.total}
                        color={COLORS.warning}
                        bg="#FFFBEB"
                    />
                    <VerificationItem
                        icon="receipt"
                        label="Fee Payments"
                        verified={stats.moduleStats.fees.verified}
                        total={stats.moduleStats.fees.total}
                        color={COLORS.success}
                        bg="#F0FDF4"
                    />
                </View>
            </View>


        </View>
    );
};
