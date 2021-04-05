const Sequelize = require('sequelize');
const JWT = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { STRING } = Sequelize;
const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/acme_db',
  config
);

const User = conn.define(
  'user',
  {
    username: STRING,
    password: STRING,
  },
  {
    hooks: {
      beforeCreate: async (user) => {
        const salt = 10;
        const hashedPassword = await bcrypt.hash(user.password, salt);
        user.password = hashedPassword;
      },
    },
  }
);

const Note = conn.define('note', {
  text: STRING,
});

Note.belongsTo(User);
User.hasMany(Note);

User.byToken = async (jwtToken) => {
  try {
    const token = JWT.verify(jwtToken, process.env.JWT);
    if (token) {
      const user = await User.findByPk(token.id, { include: Note });
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const users = await User.findAll({
    where: {
      username,
    },
  });
  const user = users.filter((user) =>
    bcrypt.compare(password, user.password)
  )[0];

  if (user) {
    return JWT.sign({ id: user.id }, process.env.JWT);
  }
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

const syncAndSeed = async () => {
  await conn.sync({ force: true });

  const credentials = [
    { username: 'lucy', password: 'lucy_pw' },
    { username: 'moe', password: 'moe_pw' },
    { username: 'larry', password: 'larry_pw' },
  ];

  const notes = [
    { text: 'It is a beautiful day outside.' },
    { text: 'I would like to go for a walk.' },
    { text: 'The birds are singing.' },
    { text: 'The flowers are in bloom.' },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );

  const [noteOne, noteTwo, noteThree, noteFour] = await Promise.all(
    notes.map((note) => Note.create(note))
  );

  lucy.addNote(noteTwo);
  moe.addNotes([noteOne, noteThree]);
  larry.addNote(noteFour);

  return {
    notes: {
      noteOne,
      noteTwo,
      noteThree,
      noteFour,
    },
    users: {
      lucy,
      moe,
      larry,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
