export const STUDENT_PROFILE_STYLES = `
    /* Scoped Styles for A4 Page */
    .a4-page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 15mm 20mm;
        background: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        color: #000000;
        line-height: 1.4;
        font-size: 11pt;
        box-sizing: border-box;
        position: relative;
    }

    .a4-page * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }
    
    /* A4 Page Setup for Print */
    @page {
        size: A4;
        margin: 0;
    }
    
    /* Header Section */
    .a4-page .header {
        text-align: center;
        border-bottom: 2px solid #000000;
        padding-bottom: 15px;
        margin-bottom: 20px;
    }
    
    .a4-page .logos {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }
    
    .a4-page .logo {
        width: 80px;
        height: 80px;
        border: 1px solid #ddd;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #666;
    }
    
    .a4-page .logo img {
        max-width: 100%;
        max-height: 100%;
    }
    
    .a4-page .college-name {
        font-size: 14pt;
        font-weight: bold;
        margin: 5px 0;
    }
    
    .a4-page .college-subtitle {
        font-size: 11pt;
        font-weight: normal;
        margin-bottom: 5px;
    }
    
    .a4-page .report-title {
        font-size: 16pt;
        font-weight: bold;
        margin: 10px 0;
        text-decoration: underline;
    }
    
    .a4-page .meta-info {
        font-size: 9pt;
        color: #666;
        margin-top: 10px;
        border-top: 1px solid #eee;
        padding-top: 5px;
    }
    
    /* Student Identity Section */
    .a4-page .identity-section {
        display: flex;
        margin-bottom: 25px;
        padding-bottom: 20px;
        border-bottom: 1px solid #ddd;
    }
    
    .a4-page .student-photo-container {
        width: 120px;
        height: 150px;
        border: 1px solid #ddd;
        margin-right: 25px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8f8f8;
        overflow: hidden;
    }
    
    .a4-page .student-photo-container img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .a4-page .basic-info {
        flex: 1;
    }
    
    .a4-page .student-name {
        font-size: 16pt;
        font-weight: bold;
        margin-bottom: 15px;
    }
    
    .a4-page .info-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
    }
    
    .a4-page .info-item {
        margin-bottom: 8px;
    }
    
    .a4-page .info-label {
        font-weight: 600;
        font-size: 10pt;
        display: block;
        margin-bottom: 2px;
    }
    
    .a4-page .info-value {
        font-size: 11pt;
    }
    
    /* Two Column Layout */
    .a4-page .two-column {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-bottom: 25px;
    }
    
    .a4-page .section {
        margin-bottom: 20px;
    }
    
    .a4-page .section-title {
        font-size: 12pt;
        font-weight: bold;
        border-bottom: 1px solid #000;
        padding-bottom: 5px;
        margin-bottom: 15px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    /* Academic Section */
    .a4-page .gpa-display {
        display: flex;
        justify-content: space-around;
        margin: 20px 0;
        padding: 15px 0;
        border-top: 1px solid #ddd;
        border-bottom: 1px solid #ddd;
    }
    
    .a4-page .gpa-item {
        text-align: center;
    }
    
    .a4-page .gpa-value {
        font-size: 18pt;
        font-weight: bold;
        display: block;
    }
    
    .a4-page .gpa-label {
        font-size: 10pt;
        margin-top: 5px;
    }
    
    /* Tables */
    .a4-page table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
        font-size: 10pt;
    }
    
    .a4-page table th {
        background: #f8f8f8;
        border: 1px solid #ddd;
        padding: 8px 10px;
        text-align: left;
        font-weight: 600;
    }
    
    .a4-page table td {
        border: 1px solid #ddd;
        padding: 6px 10px;
    }
    
    .a4-page table tr:nth-child(even) {
        background: #fafafa;
    }
    
    /* Fee Summary */
    .a4-page .fee-summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin: 20px 0;
    }
    
    .a4-page .fee-card {
        border: 1px solid #ddd;
        padding: 15px;
        text-align: center;
    }
    
    .a4-page .fee-amount {
        font-size: 14pt;
        font-weight: bold;
        margin: 10px 0;
    }
    
    /* Portfolio Section */
    .a4-page .portfolio-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-top: 20px;
    }
    
    /* Footer */
    .a4-page .footer {
        margin-top: 30px;
        padding-top: 15px;
        border-top: 1px solid #ddd;
        font-size: 9pt;
        color: #666;
        text-align: center;
    }
    
    /* Utility Classes */
    .a4-page .text-center {
        text-align: center;
    }
    
    .a4-page .mb-10 {
        margin-bottom: 10px;
    }
    
    .a4-page .mb-20 {
        margin-bottom: 20px;
    }
    
    .a4-page .mt-20 {
        margin-top: 20px;
    }

    /* Status Badge Colors */
    .a4-page .status-verified { color: #2E7D32; font-weight: bold; }
    .a4-page .status-pending { color: #EF6C00; font-weight: bold; }
    .a4-page .status-rejected { color: #C62828; font-weight: bold; }

    /* Print Styles */
    @media print {
        .a4-page {
            width: 100%;
            height: auto;
            margin: 0;
            padding: 15mm 20mm;
            box-shadow: none;
        }
    }
`;

export const STUDENT_PROFILE_CONTENT = `
    <div class="a4-page">
        <!-- Header -->
        <header class="header">
            <div class="logos">
                <div class="logo"><img src="{{college_logo_left}}" alt="Logo Left"></div>
                <div class="logo"><img src="{{college_logo_right}}" alt="Logo Right"></div>
            </div>
            
            <div class="college-name">
                Jayawant Shikshan Prasarak Mandal's
            </div>
            <div class="college-subtitle">
                Rajarshi Shahu College of Engineering, Tathawade, Pune
            </div>
            <div class="college-subtitle">
                (Autonomous Institute)
            </div>
            
            <div class="report-title">{{report_title}}</div>
            
            <div class="meta-info">
                <div>Generated on: {{gen_date}}</div>
                <div>Filters: {{filters_used}}</div>
            </div>
        </header>

        <!-- Student Identity -->
        <section class="identity-section">
            <div class="student-photo-container">
                <img src="{{student_photo}}" alt="Student Photo">
            </div>
            
            <div class="basic-info">
                <div class="student-name">{{full_name}}</div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">PRN Number</span>
                        <span class="info-value">{{prn}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Branch</span>
                        <span class="info-value">{{branch}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Division</span>
                        <span class="info-value">{{division}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">SGPA</span>
                        <span class="info-value">{{sgpa}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">CGPA</span>
                        <span class="info-value">{{cgpa}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Academic Year</span>
                        <span class="info-value">{{year}}</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- Personal & Family Information -->
        <div class="two-column">
            <!-- Personal Information -->
            <section class="section">
                <div class="section-title">Personal Information</div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Date of Birth</span>
                        <span class="info-value">{{dob}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Gender</span>
                        <span class="info-value">{{gender}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email Address</span>
                        <span class="info-value">{{email}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Phone Number</span>
                        <span class="info-value">{{phone}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Aadhar Number</span>
                        <span class="info-value">{{aadhar}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Category</span>
                        <span class="info-value">{{category}}</span>
                    </div>
                </div>
                
                <div class="info-item mb-10">
                    <span class="info-label">Permanent Address</span>
                    <div class="info-value">{{permanent_addr}}</div>
                </div>
                
                <div class="info-item">
                    <span class="info-label">Temporary Address</span>
                    <div class="info-value">{{temp_addr}}</div>
                </div>
            </section>

            <!-- Family Information -->
            <section class="section">
                <div class="section-title">Family Information</div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Father's Name</span>
                        <span class="info-value">{{father_name}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Mother's Name</span>
                        <span class="info-value">{{mother_name}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Father's Contact</span>
                        <span class="info-value">{{father_phone}}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Annual Income</span>
                        <span class="info-value">{{annual_income}}</span>
                    </div>
                </div>
            </section>
        </div>

        <!-- Academic Information -->
        <section class="section">
            <div class="section-title">Academic Information</div>
            
            <div class="section-title" style="font-size: 11pt; border-bottom: none; margin-bottom: 5px;">Schooling / Junior College</div>
            <table>
                <thead>
                    <tr>
                        <th>Examination</th>
                        <th>School/College Name</th>
                        <th>Total Marks</th>
                        <th>Marks Obtained</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>SSC (10th)</td>
                        <td>{{ssc_school}}</td>
                        <td>{{ssc_total}}</td>
                        <td>{{ssc_obtained}}</td>
                        <td>{{ssc_perc}}%</td>
                    </tr>
                    <tr>
                        <td>{{hsc_diploma_label}}</td>
                        <td>{{hsc_diploma_college}}</td>
                        <td>{{hsc_diploma_total}}</td>
                        <td>{{hsc_diploma_obtained}}</td>
                        <td>{{hsc_diploma_perc}}%</td>
                    </tr>
                </tbody>
            </table>
            
            <div class="gpa-display">
                <div class="gpa-item">
                    <span class="gpa-value">{{sgpa}}</span>
                    <span class="gpa-label">Current Semester SGPA</span>
                </div>
                <div class="gpa-item">
                    <span class="gpa-value">{{cgpa}}</span>
                    <span class="gpa-label">Cumulative CGPA</span>
                </div>
            </div>
            
            <!-- Academic Table -->
            <div class="section-title" style="font-size: 11pt;">Semester-wise Performance</div>
            {{academic_table}}
        </section>

        <!-- Fee Details -->
        <section class="section">
            <div class="section-title">Fee Details</div>
            
            <div class="fee-summary">
                <div class="fee-card">
                    <div class="info-label">Total Fee</div>
                    <div class="fee-amount">₹{{total_fee}}</div>
                </div>
                <div class="fee-card">
                    <div class="info-label">Paid Amount</div>
                    <div class="fee-amount">₹{{paid_fee}}</div>
                </div>
                <div class="fee-card">
                    <div class="info-label">Balance Due</div>
                    <div class="fee-amount">₹{{balance_fee}}</div>
                </div>
            </div>
            
            <!-- Fee Payment Table -->
            <div class="section-title" style="font-size: 11pt; margin-top: 20px;">Fee Payment Details</div>
            {{fee_table}}
            
            {{view_receipt_btn}}
        </section>

        <!-- Portfolio Section -->
        <div class="portfolio-section">
            <!-- Activities -->
            <section class="section">
                <div class="section-title">Activities & Achievements</div>
                {{activities_table}}
            </section>
            
            <!-- Internships -->
            <section class="section">
                <div class="section-title">Internships & Training</div>
                {{internships_table}}
                {{view_certificate_btn}}
            </section>
        </div>

        <!-- Footer -->
        <footer class="footer">
            <div class="mb-10">
                This document is system generated from GFM Record.<br>
                For official verification, contact the administration office.
            </div>
            <div>
                © Rajarshi Shahu College of Engineering, Tathawade, Pune
            </div>
        </footer>
    </div>
`;

export function populateTemplate(data: Record<string, string>, wrapFull = true) {
    let content = STUDENT_PROFILE_CONTENT;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        content = content.replace(regex, value);
    }
    
    if (!wrapFull) {
        return `<style>${STUDENT_PROFILE_STYLES}</style>${content}`;
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Student Profile</title>
    <style>${STUDENT_PROFILE_STYLES}</style>
</head>
<body>
    ${content}
</body>
</html>`;
}
