import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

const { documentDirectory, EncodingType } = FileSystem as any;

export const saveAndShareCSV = async (csvData: string, filename: string) => {
    try {
        if (Platform.OS === 'web') {
            // Web Download Strategy
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        if (!documentDirectory) {
            throw new Error('FileSystem documentDirectory is not available');
        }
        const fileUri = `${documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, csvData, {
            encoding: EncodingType?.UTF8 || 'utf8'
        });

        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert('Error', 'Sharing is not available on this device');
            }
        }
    } catch (error) {
        console.error('Error saving CSV:', error);
        Alert.alert('Error', 'Failed to save or share CSV file');
    }
};

export const generateTodayAttendanceCSV = (metrics: any[]) => {
    // metrics: { division: 'A', present: 10, absent: 5, total: 15 }
    let csv = 'Division,Present,Absent,Total,Attendance %\n';
    metrics.forEach(m => {
        const percentage = m.total ? ((m.present / m.total) * 100).toFixed(1) : '0';
        csv += `${m.division},${m.present},${m.absent},${m.total},${percentage}%\n`;
    });
    return csv;
};

export const generateGFMAuditCSV = (auditData: any[]) => {
    // auditData: { name: '...', prn: '...', division: '...', batch: '...', status: '...', gfmName: '...', callTime: '...', reason: '...' }
    let csv = 'Student Name,PRN,Division,Batch,Status,GFM Name,Call Time,Reason/Note\n';
    auditData.forEach(d => {
        const name = d.studentName || d.studentPrn;
        const cleanReason = d.reason ? d.reason.replace(/,/g, ';') : ''; // Escape commas
        csv += `${name},${d.studentPrn},${d.division || '-'},${d.batch || '-'},${d.status},${d.gfmName || 'N/A'},${d.callTime || 'Pending'},${cleanReason}\n`;
    });
    return csv;
};

export const generateDetailedGFMReportCSV = (data: any[]) => {
    // Group by Batch to create summary
    const summaries: any = {};
    data.forEach(d => {
        const key = `${d.dept}-${d.year}-${d.div}-${d.batch}`;
        if (!summaries[key]) summaries[key] = { dept: d.dept, year: d.year, div: d.div, batch: d.batch, absentCount: 0 };
        summaries[key].absentCount++;
    });

    let csv = '--- BATCH SUMMARY ---\n';
    csv += 'Department,Year,Division,Batch,Total Absents\n';
    Object.values(summaries).forEach((s: any) => {
        csv += `${s.dept},${s.year},${s.div},${s.batch},${s.absentCount}\n`;
    });
    csv += '\n';

    csv += '--- DETAILED STUDENT RECORDS ---\n';
    csv += 'Department,Year,Division,Batch,Student Name,PRN,Status,GFM Called,Call Reason,Leave Note,Proof Link\n';
    data.forEach(d => {
        const cleanReason = (d.reason || '').replace(/,/g, ';').replace(/\n/g, ' ');
        const cleanLeave = (d.leaveNote || '').replace(/,/g, ';').replace(/\n/g, ' ');
        csv += `${d.dept},${d.year},${d.div},${d.batch},"${d.name}","${d.prn}",${d.status},${d.isCompliant ? 'Yes' : 'No'},"${cleanReason}","${cleanLeave}","${d.leaveProofUrl || ''}"\n`;
    });
    return csv;
};
