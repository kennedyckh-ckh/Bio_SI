import { all, get, run, tx, now, num } from "./db";
import { hashPassword } from "./auth";

export const DEMO_ACCOUNTS = [
  {
    role: "teacher",
    name: "Mr Ng",
    email: "teacher1@school.test",
    password: "Teacher1!demo",
  },
  {
    role: "teacher",
    name: "Mr Lau",
    email: "teacher2@school.test",
    password: "Teacher2!demo",
  },
  {
    role: "teacher",
    name: "Mr Yu",
    email: "teacher3@school.test",
    password: "Teacher3!demo",
  },
  {
    role: "educator",
    name: "Kennedy",
    email: "kennedyckh@hku.hk",
    password: "Educator1!demo",
  },
] as const;

/**
 * Updates the original demo accounts without recreating them.
 * Account IDs, password hashes, assignments, and associated data are preserved.
 */
function updateExistingDemoAccounts() {
  tx(() => {
    const oldEducator = get(
      "SELECT id FROM users WHERE email = ? AND role = ?",
      "educator@school.test",
      "educator"
    );

    const targetAccount = get(
      "SELECT id FROM users WHERE email = ?",
      "kennedyckh@hku.hk"
    );

    // Avoid silently merging two accounts or creating an email conflict.
    if (oldEducator && targetAccount) {
      throw new Error(
        "Cannot change the educator login: both educator@school.test and kennedyckh@hku.hk already exist. No account changes were applied."
      );
    }

    if (oldEducator) {
      run(
        "UPDATE users SET name = ?, email = ? WHERE email = ? AND role = ?",
        "Kennedy",
        "kennedyckh@hku.hk",
        "educator@school.test",
        "educator"
      );
    }

    // Rename teachers only if they still have the original demo names.
    run(
      "UPDATE users SET name = ? WHERE email = ? AND role = ? AND name = ?",
      "Mr Ng",
      "teacher1@school.test",
      "teacher",
      "Ms Chan (Teacher 1)"
    );

    run(
      "UPDATE users SET name = ? WHERE email = ? AND role = ? AND name = ?",
      "Mr Lau",
      "teacher2@school.test",
      "teacher",
      "Mr Lee (Teacher 2)"
    );

    run(
      "UPDATE users SET name = ? WHERE email = ? AND role = ? AND name = ?",
      "Mr Yu",
      "teacher3@school.test",
      "teacher",
      "Ms Wong (Teacher 3)"
    );
  });
}

export function seedIfEmpty() {
  // Apply account changes even when the database already contains users.
  updateExistingDemoAccounts();

  // Do not recreate accounts or templates in an existing database.
  if (get("SELECT 1 FROM users LIMIT 1")) return;

  tx(() => {
    const ids: Record<string, number> = {};

    for (const account of DEMO_ACCOUNTS) {
      ids[account.email] = run(
        "INSERT INTO users(role,name,email,password_hash,created_at) VALUES(?,?,?,?,?)",
        account.role,
        account.name,
        account.email,
        hashPassword(account.password),
        now()
      ).id;
    }

    const educatorId = ids["kennedyckh@hku.hk"];

    // Kennedy is assigned to Mr Ng and Mr Lau.
    // Mr Yu remains deliberately unassigned for the original RBAC test.
    run(
      "INSERT INTO educator_teacher(educator_id,teacher_id) VALUES(?,?)",
      educatorId,
      ids["teacher1@school.test"]
    );

    run(
      "INSERT INTO educator_teacher(educator_id,teacher_id) VALUES(?,?)",
      educatorId,
      ids["teacher2@school.test"]
    );

    const templateId = run(
      "INSERT INTO templates(educator_id,title,pedagogy_notes,ai_criteria,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      educatorId,
      "Which paper towel absorbs the most water?",
      "Rationale: students often treat 'fair test' as a slogan. Part 1 pushes them to name the independent, dependent and control variables before touching equipment. In Part 3, steer the class to compare their predictions with the data and to separate what the data show from what they believe. Watch for the misconception that 'thicker always means more absorbent'.",
      "Prioritise divergent findings between groups, uncontrolled variables (e.g. soaking time, towel size), gaps between evidence and claims, and misconceptions about absorption.",
      1,
      now(),
      now()
    ).id;

    const parts: Record<number, [string, string, string[]]> = {
      1: [
        "Plan a fair test to compare how much water different brands of paper towel can absorb. Decide what you will change, what you will measure and what you must keep the same. Write your aim and a hypothesis with a reason.",
        "https://www.stem.org.uk/",
        [
          "What is your aim, in one sentence?",
          "What will you change (independent variable) and what will you measure (dependent variable)?",
          "Which variables must you control, and how?",
          "What do you predict, and why?",
        ],
      ],
      2: [
        "Carry out your plan. Record every observation and measurement. If you change the plan, write down what you changed and why.",
        "https://www.stem.org.uk/",
        [
          "What did you observe? Add a data table.",
          "Did anything go differently from your plan?",
          "Attach a photo of your set-up or your result.",
        ],
      ],
      3: [
        "Compare your results with your Part 1 plan. Use the Reference Panel to check your hypothesis and your controls against what actually happened.",
        "",
        [
          "Was your hypothesis supported? Which evidence shows this?",
          "What limitations affected your results?",
          "How would you improve the investigation?",
        ],
      ],
    };

    for (const part of [1, 2, 3]) {
      run(
        "INSERT INTO template_parts(template_id,part,instructions,web_link) VALUES(?,?,?,?)",
        templateId,
        part,
        parts[part][0],
        parts[part][1]
      );

      parts[part][2].forEach((question, index) => {
        run(
          "INSERT INTO template_questions(template_id,part,position,text) VALUES(?,?,?,?)",
          templateId,
          part,
          index,
          question
        );
      });
    }

    for (const email of [
      "teacher1@school.test",
      "teacher2@school.test",
    ]) {
      run(
        "INSERT INTO template_assignments(template_id,teacher_id,note,ref_links_json,assigned_at) VALUES(?,?,?,?,?)",
        templateId,
        ids[email],
        "Please try this with your Year 8 class. Feel free to adapt the questions.",
        JSON.stringify([
          {
            label: "Fair-testing background reading",
            url: "https://www.stem.org.uk/",
          },
        ]),
        now()
      );
    }
  });

  void all;
  void num;
}