const fs = require('fs');
const path = require('path');

// 1. Controller
const cPath = path.resolve(__dirname, '../back-end/src/mentor-applications/mentor-applications.controller.ts');
let cContent = fs.readFileSync(cPath, 'utf8');

cContent = cContent.replace(
  /approve\(@Param\('id'\)\s*id:\s*string\):\s*MentorApplicationEntity\s*\{[\r\n\s]*return this\.mentorApplicationsService\.approve\(id\);[\r\n\s]*\}/,
  `approve(@Param('id') id: string, @CurrentUser() adminUser: any): MentorApplicationEntity {\n    const adminName = adminUser?.name || adminUser?.email || 'Admin';\n    return this.mentorApplicationsService.approve(id, adminName);\n  }`
);

cContent = cContent.replace(
  /reject\(@Param\('id'\)\s*id:\s*string,\s*@Body\(\)\s*body:\s*\{\s*reason\?:\s*string\s*\},\s*@CurrentUser\('name'\)\s*adminName:\s*string\):\s*MentorApplicationEntity\s*\{[\r\n\s]*return this\.mentorApplicationsService\.reject\(id,\s*body\?\.reason,\s*adminName\);[\r\n\s]*\}/,
  `reject(@Param('id') id: string, @Body() body: { reason?: string }, @CurrentUser() adminUser: any): MentorApplicationEntity {\n    const adminName = adminUser?.name || adminUser?.email || 'Admin';\n    return this.mentorApplicationsService.reject(id, body?.reason, adminName);\n  }`
);

fs.writeFileSync(cPath, cContent, 'utf8');
console.log('Successfully updated mentor-applications.controller.ts');

// 2. Service
const sPath = path.resolve(__dirname, '../back-end/src/mentor-applications/mentor-applications.service.ts');
let sContent = fs.readFileSync(sPath, 'utf8');

if (!sContent.includes('MENTOR_APPLICATION_APPROVED')) {
  sContent = sContent.replace(
    /if\s*\(user\)\s*\{[\r\n\s]*this\.usersService\.update\(String\(user\.id\),\s*\{[\r\n\s]*role:\s*UserRole\.Mentor,[\r\n\s]*profile:\s*\{\s*\.\.\.\(user\.profile\s*\|\|\s*\{\}\),\s*mentorUnlocked:\s*true\s*\},[\r\n\s]*\}\);[\r\n\s]*\}/,
    `if (user) {\n      this.usersService.update(String(user.id), {\n        role: UserRole.Mentor,\n        profile: { ...(user.profile || {}), mentorUnlocked: true },\n      });\n      (user as any).mentorUnlocked = true;\n      if (user.data) {\n        (user.data as any).mentorUnlocked = true;\n      }\n    }\n\n    // Notify applicant upon approval\n    try {\n      this.notificationsService.create({\n        userId: String(application.userId),\n        type: 'MENTOR_APPLICATION_APPROVED',\n        title: 'Mentor Application Approved',\n        message: '🎉 Congratulations! Your mentor application was approved. You can now switch to the Mentor role and access mentor features.',\n        readStatus: false,\n        referenceId: id,\n      });\n    } catch { /* non-critical */ }`
  );
  fs.writeFileSync(sPath, sContent, 'utf8');
  console.log('Successfully updated mentor-applications.service.ts');
} else {
  console.log('mentor-applications.service.ts already contains MENTOR_APPLICATION_APPROVED');
}
