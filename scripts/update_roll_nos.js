const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pgmrerxzioafpzwclqmx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbXJlcnh6aW9hZnB6d2NscW14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzMwOTQsImV4cCI6MjA4MzY0OTA5NH0.Zp5dTkhxMTzw8A5zo2zgm95d-Uu-8q7VQcvLqbjEYok';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function updateRollNos() {
    console.log('🚀 Starting Roll Number Update...');
    const { data: students, error } = await supabase
        .from('students')
        .select('prn, roll_no');

    if (error) {
        console.error('❌ Error fetching students:', error);
        return;
    }

    console.log(`📋 Found ${students.length} students. Updating...`);

    for (const student of students) {
        const prn = student.prn;
        // PRN format: RBT[YY]CS[XXX]
        // Example: RBT21CS045
        // YY = 21, last 2 digits = 45
        const yearPart = prn.substring(3, 5);
        const lastTwoDigits = prn.slice(-2);
        const newRollNo = `CS${yearPart}${lastTwoDigits}`;

        console.log(`🔄 Updating ${prn}: ${student.roll_no} -> ${newRollNo}`);

        const { error: updateError } = await supabase
            .from('students')
            .update({ roll_no: newRollNo })
            .eq('prn', prn);

        if (updateError) {
            console.error(`❌ Failed to update ${prn}:`, updateError.message);
        }
    }

    console.log('✅ Roll Number Update Complete!');
}

updateRollNos();
