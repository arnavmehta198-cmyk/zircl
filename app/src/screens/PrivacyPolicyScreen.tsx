import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/icons'

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'The Waitlist',
    body:
      'If you join the waitlist on our marketing site at zircl.org, the only thing we collect is your email ' +
      'address, plus your IP address briefly, which is used solely to rate-limit signups and stop abuse. We ' +
      'use your email for one thing: to tell you when Zircl launches. We do not add you to a mailing list, ' +
      'share it, or sell it. Ask us at the address below and we will delete it.',
  },
  {
    title: 'Information We Collect',
    body:
      'When you create a Zircl account we collect the information you give us: your name, email address, ' +
      'date of birth, profile photos, the hobbies you select, and the content of the messages you send. ' +
      'With your permission we also use your device location to show you clubs and people nearby, and your ' +
      'calendar to add events you RSVP to. You can decline either permission and still use Zircl.',
  },
  {
    title: 'How We Use Your Information',
    body:
      'We use your information to operate the core features of the app: matching you with people who share ' +
      'your hobbies, showing nearby clubs and activities, delivering your messages, and scheduling events. ' +
      'We do not sell your data to anyone, and we do not use it for advertising.',
  },
  {
    title: 'Sharing',
    body:
      'Your profile — your name, age, photos, bio, and hobbies — is visible to other Zircl users. Messages you ' +
      'send are visible to the people or clubs you send them to. We use Google Firebase as our infrastructure ' +
      'provider for authentication, database, and file storage; your data is stored on their servers on our behalf.',
  },
  {
    title: 'Your Choices',
    body:
      'You can edit or remove any part of your profile at any time. You can block or report any user directly ' +
      'from their profile or from a conversation. You can delete your account from Settings, which permanently ' +
      'removes your profile, photos, messages, club memberships, and all other data associated with you.',
  },
  {
    title: 'Data Retention',
    body:
      'We keep your information for as long as your account is active. When you delete your account, your data ' +
      'is removed from our active systems. Some records may persist briefly in encrypted backups before being ' +
      'overwritten in the normal course of operation.',
  },
  {
    title: "Children's Privacy",
    body:
      'Zircl is not directed at children under 13, and we do not knowingly collect information from them. ' +
      'Zircl also requires all users to be at least 18 years old. If we learn that we have collected information ' +
      'from a child, we will delete it.',
  },
  {
    title: 'Contact Us',
    body:
      'If you have any questions about this policy or about how your information is handled, email us at ' +
      '3launchx@gmail.com and we will get back to you.',
  },
]

export default function PrivacyPolicyScreen() {
  const navigate = useNavigate()

  return (
    <div className="min-h-full bg-dusk-950">
      <div className="mx-auto max-w-[720px] px-5 sm:px-8 py-10 lg:py-16">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="inline-flex items-center gap-1 -ml-1 text-[13.5px] font-medium text-ink-2
                     hover:text-ink transition-colors"
        >
          <Icon.ChevronLeft size={16} /> Back
        </button>

        <article className="mt-8">
          <div className="eyebrow mb-3">Legal</div>
          <h1 className="text-[32px] font-display font-extrabold tracking-tight leading-tight text-ink">
            Privacy Policy
          </h1>
          <p className="meta mt-2">Last updated: August 5, 2026</p>

          <div className="mt-10 flex flex-col gap-9">
            {SECTIONS.map((s) => (
              <section key={s.title}>
                <h2 className="text-[17px] font-display font-medium text-ink">{s.title}</h2>
                <p className="text-[15px] text-ink-2 leading-[1.75] mt-2.5">{s.body}</p>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}
