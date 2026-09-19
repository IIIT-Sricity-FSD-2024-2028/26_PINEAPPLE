let dataList = [];
try {
  const res = await fetch("http://localhost:3000/YHR", {
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "superuser" 
    }
  });

  if (res.ok) {
    dataList = await res.json();
  } else {
    dataList = YOUR_FALLBACK_ARRAY || [];
  }
} catch (err) {
  console.warn("Backend error, using fallback:", err);
  dataList = YOUR_FALLBACK_ARRAY || [];
}

//aliases
const roleAliases = {
      'admin': ['administrator', 'admin', 'portal admin', 'portal_admin'],
      'administrator': ['administrator', 'admin', 'portal admin', 'portal_admin'],
      'user': ['collaborator', 'project owner', 'mentor', 'administrator', 'admin', 'super user', 'superuser', 'user'],
      'collaborator': ['collaborator', 'administrator', 'admin', 'super user', 'superuser', 'user'],
      'project owner': ['project owner', 'administrator', 'admin', 'super user', 'superuser'],
      'mentor': ['mentor', 'administrator', 'admin', 'super user', 'superuser'],
      'superuser': ['super user', 'superuser'],
      'super user': ['super user', 'superuser'],
      'portal_admin': ['administrator', 'admin', 'portal admin', 'portal_admin'],
      'portal admin': ['administrator', 'admin', 'portal admin', 'portal_admin']
    };

//  Backend is running on: http://localhost:3000
//  Swagger documentation is available at: http://localhost:3000/api
