#!/usr/bin/env node
// Manage Windchill Trainer accounts from the command line.
//   npm run user -- add <username> [--role viewer|editor|admin]
//   npm run user -- passwd <username>
//   npm run user -- role <username> <role>
//   npm run user -- remove <username>
//   npm run user -- list
// Passwords are prompted for; set WT_PASSWORD to supply one non-interactively.
import readline from 'node:readline';
import { ROLES } from '../src/config.js';
import { createUser, setPassword, setRole, deleteUser, listUsers } from '../src/users.js';

function promptHidden(question) {
  if (process.env.WT_PASSWORD) return Promise.resolve(process.env.WT_PASSWORD);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) rl.output.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function newPassword() {
  const pw = await promptHidden('Password: ');
  if (!process.env.WT_PASSWORD && pw !== (await promptHidden('Confirm password: '))) {
    throw new Error('Passwords do not match.');
  }
  return pw;
}

function usage() {
  console.log(`Usage:
  npm run user -- add <username> [--role ${ROLES.join('|')}]
  npm run user -- passwd <username>
  npm run user -- role <username> <${ROLES.join('|')}>
  npm run user -- remove <username>
  npm run user -- list`);
  process.exit(1);
}

const [cmd, username, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case 'add': {
      if (!username) usage();
      const i = rest.indexOf('--role');
      const role = i === -1 ? 'viewer' : rest[i + 1];
      const user = await createUser(username, await newPassword(), role);
      console.log(`Created ${user.role} "${user.username}".`);
      break;
    }
    case 'passwd':
      if (!username) usage();
      await setPassword(username, await newPassword());
      console.log(`Password updated for "${username}".`);
      break;
    case 'role':
      if (!username || !rest[0]) usage();
      setRole(username, rest[0]);
      console.log(`"${username}" is now ${rest[0]}.`);
      break;
    case 'remove':
      if (!username) usage();
      deleteUser(username);
      console.log(`Removed "${username}".`);
      break;
    case 'list': {
      const users = listUsers();
      if (!users.length) console.log('No users yet.');
      for (const u of users) console.log(`${u.username.padEnd(24)} ${u.role.padEnd(8)} ${u.createdAt?.slice(0, 10) || ''}`);
      break;
    }
    default:
      usage();
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
