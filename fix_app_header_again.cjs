const fs = require('fs');
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<MainHeader\s+title=\{[\s\S]*?\}\(\)\}\s+\/>/;
appContent = appContent.replace(regex, `<MainHeader user={user} loadingAuth={loadingAuth} workspaceOwnerEmail={user?.email || null} />`);

fs.writeFileSync('src/App.tsx', appContent);
