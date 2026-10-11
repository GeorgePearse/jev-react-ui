"""Train tiny local classifiers used by the intelligent-components gallery.

Run with: uv run python examples/ui_components.py --root /tmp/modelmode-ui-demo
"""

import argparse
import json
from pathlib import Path

from modelmode import Workspace

EXAMPLES = {
    "priority": {
        "low": [
            "When convenient, update the footer copyright year.",
            "Please tidy the spacing on the settings page sometime.",
            "A minor typo appears in the help article.",
            "Consider renaming this internal variable next sprint.",
            "The profile page could use a slightly better empty state.",
            "No rush, but the button alignment is a little uneven.",
            "We can refresh these old screenshots when there is time.",
            "This small polish item can wait until later.",
            "The icon in the menu is a few pixels off center.",
            "Perhaps add a note to the onboarding copy eventually.",
        ],
        "medium": [
            "The export flow fails for some spreadsheet files.",
            "Several users cannot save their notification preferences.",
            "The weekly report is missing two important columns.",
            "Search takes too long on large customer accounts.",
            "The mobile navigation overlaps the page title.",
            "A billing screen shows the wrong renewal date.",
            "New team members are not receiving their welcome email.",
            "The dashboard chart does not include the latest month.",
            "We need to fix the duplicate rows in the CSV download.",
            "Customers are confused by the current account settings flow.",
        ],
        "high": [
            "Many customers are unable to reset their passwords today.",
            "Checkout is failing for a growing number of users.",
            "The latest release broke login on mobile devices.",
            "A security fix must ship before tomorrow morning.",
            "Our main report is showing incorrect totals for every account.",
            "Support tickets are piling up because invitations do not work.",
            "The production API is returning errors for several endpoints.",
            "We must fix the data import before the customer launch.",
            "Users are being charged twice after upgrading their plan.",
            "The authentication change is blocking the sales team.",
        ],
        "critical": [
            "Production is down and every customer is unable to log in.",
            "The live database is unavailable and requests are failing globally.",
            "Customer payment data may have been exposed in a breach.",
            "A destructive bug is deleting records from the production system.",
            "All regions are offline after the emergency deployment.",
            "The service is on fire and hospitals cannot access patient records.",
            "Credentials were leaked and attackers are actively using them.",
            "The entire checkout system is down during the launch event.",
            "We are losing live customer data with every incoming request.",
            "Immediate response needed: production outage affects all users.",
        ],
    },
    "category": {
        "bug": [
            "The login page crashes on Safari.",
            "Clicking save produces an unexpected error.",
            "The app freezes when I upload a large image.",
            "The submit button does nothing on the contact form.",
            "A blank screen appears after changing my password.",
            "The filter returns records that do not match.",
            "The page layout breaks on a small phone screen.",
            "I found a typo in the error message shown after checkout.",
            "The download link is broken in the latest release.",
            "Notifications are sent twice for the same event.",
        ],
        "feature": [
            "Please add dark mode to the dashboard.",
            "It would help to export reports as a PDF.",
            "Can we add keyboard shortcuts for common actions?",
            "I would like a calendar view for upcoming tasks.",
            "Please support sign in with a security key.",
            "Could the app let me schedule reports every Monday?",
            "We need an option to invite several teammates at once.",
            "Add a way to pin favorite projects to the sidebar.",
            "It would be useful to filter results by assigned team.",
            "Please allow custom fields on the customer profile.",
        ],
        "improvement": [
            "The settings page could be easier to navigate.",
            "Please make the report load faster for large accounts.",
            "The labels in the billing form are hard to understand.",
            "It would be nice if search results were grouped by type.",
            "Can we improve the contrast of disabled controls?",
            "The onboarding instructions need clearer examples.",
            "Please make the table columns resizable.",
            "The confirmation dialog should explain what happens next.",
            "Could the mobile menu use less screen space?",
            "The current empty state feels confusing to new users.",
        ],
        "question": [
            "How can I change the email on my account?",
            "Where do I find last month's invoice?",
            "Is there a way to restore an archived project?",
            "Can you explain how team permissions work?",
            "Which file formats can I upload?",
            "When will the next report be available?",
            "Do you support single sign on for small teams?",
            "Who can see the notes I add to a customer?",
            "How do I transfer ownership to another person?",
            "Does the starter plan include audit logs?",
        ],
        "incident": [
            "The production database is down and customers cannot log in.",
            "Our service is returning errors in every region.",
            "The live payment processor stopped accepting transactions.",
            "A major outage is preventing users from accessing their data.",
            "The production deployment has taken the website offline.",
            "All API requests are timing out after the latest release.",
            "Customers are unable to complete purchases right now.",
            "The authentication service is unavailable for everyone.",
            "We have a live outage affecting the customer dashboard.",
            "The production queue is stuck and new jobs are not running.",
        ],
    },
    "sentiment": {
        "very negative": [
            "This is absolutely awful and completely unacceptable.",
            "I hate this experience; everything is broken again.",
            "The service is a disaster and I am furious.",
            "Worst product ever, I regret signing up.",
            "This failure has ruined my entire day.",
            "I am disgusted by how badly this was handled.",
            "Nothing works and your support has been terrible.",
            "This is infuriating and totally hopeless.",
            "I cannot believe how miserable this experience is.",
            "The update made everything much worse; I am livid.",
        ],
        "negative": [
            "I am frustrated that the report is late.",
            "The new layout is confusing and hard to use.",
            "I am disappointed with the slow response.",
            "This issue is annoying, but I can work around it.",
            "The instructions were not very helpful.",
            "It is inconvenient that my settings did not save.",
            "The support reply did not answer my question.",
            "I expected this feature to work better.",
            "The page took a long time to load today.",
            "I am unhappy about having to repeat these steps.",
        ],
        "neutral": [
            "The meeting starts at three in the afternoon.",
            "I updated the address in my account settings.",
            "The report contains twelve rows of information.",
            "Please send the document to the project channel.",
            "My subscription renews on the first of next month.",
            "The button is located below the page heading.",
            "I have attached the requested spreadsheet.",
            "The account currently has four active members.",
            "The message was received this morning.",
            "The task is assigned to the platform team.",
        ],
        "positive": [
            "The new dashboard is clear and helpful.",
            "Thanks, that solved the problem for me.",
            "I like how simple the setup was.",
            "The report looks good and has the details I need.",
            "I am happy with the quick response.",
            "This feature makes my daily work easier.",
            "The instructions were clear and easy to follow.",
            "I appreciate the thoughtful update.",
            "The app is working well for our team.",
            "That is a useful improvement, thank you.",
        ],
        "very positive": [
            "This is amazing, I absolutely love it!",
            "Fantastic work; this is the best update ever.",
            "I am thrilled with how beautifully this turned out.",
            "Outstanding service, I could not be happier.",
            "Incredible experience, everything is perfect now.",
            "Brilliant! This exceeded all my expectations.",
            "I adore the new workflow; it is wonderful.",
            "Superb result, your team is phenomenal.",
            "This is wonderful and made my whole week.",
            "Excellent, exceptional, and delightful from start to finish.",
        ],
    },
    "emoji": {
        "😂": [
            "That joke made me laugh so hard",
            "I am cracking up right now",
            "This is hilarious",
            "LOL that was funny",
            "I cannot stop laughing",
            "What a ridiculous punchline",
            "That story had me in stitches",
            "So funny I nearly cried",
            "This meme is comedy gold",
            "I laughed out loud at that",
        ],
        "❤️": [
            "I love you so much",
            "Sending love to everyone",
            "You mean the world to me",
            "My heart is full of affection",
            "Love this person dearly",
            "I care about you deeply",
            "That was a loving message",
            "You are very special to me",
            "All my love to your family",
            "I adore you",
        ],
        "😢": [
            "I am so sad about this",
            "That news made me cry",
            "Feeling heartbroken today",
            "I miss them so much",
            "This is a very sad story",
            "I feel sympathy for your loss",
            "Such a difficult and painful day",
            "I am grieving the bad news",
            "That made me feel really blue",
            "Sending comfort after this loss",
        ],
        "😡": [
            "I am furious about this",
            "This makes me so angry",
            "I am fed up with the failure",
            "That behavior is outrageous",
            "Absolutely unacceptable service",
            "I am enraged by this decision",
            "This is incredibly frustrating",
            "What a disgraceful response",
            "I cannot stand this anymore",
            "That made me mad",
        ],
        "🤔": [
            "I wonder what this means",
            "Let me think about it",
            "I am not sure which option",
            "That is an interesting question",
            "Maybe we should consider it",
            "I am trying to figure this out",
            "Could you explain the reasoning",
            "I have some doubts about this",
            "Thinking through the possibilities",
            "I need a moment to decide",
        ],
        "🙏": [
            "Thank you so much for helping",
            "Please could you take a look",
            "I really appreciate your kindness",
            "Many thanks for the support",
            "Would you kindly send it today",
            "Grateful for your assistance",
            "Please accept my sincere thanks",
            "Thanks for being there for me",
            "I appreciate the favor",
            "Could you please help me",
        ],
        "🎉": [
            "We did it, congratulations everyone",
            "Happy birthday, have a great day",
            "The launch was a huge success",
            "Time to celebrate the good news",
            "We won the championship",
            "Congratulations on your promotion",
            "The project is finally complete",
            "It is party time tonight",
            "Amazing news, we are celebrating",
            "Cheers to the successful release",
        ],
        "👍": [
            "Sounds good to me",
            "I agree with that plan",
            "Yes, that works perfectly",
            "Approved, go ahead",
            "Okay, got it",
            "That is a good idea",
            "I am on board with this",
            "Works for me, thanks",
            "Absolutely, let's do that",
            "Confirmed, everything looks right",
        ],
    },
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    workspace = Workspace(args.root)
    for name, examples in EXAMPLES.items():
        rows = []
        for label, texts in examples.items():
            for index, text in enumerate(texts):
                split = "train" if index < 6 else "validation" if index < 8 else "test"
                rows.append(
                    {
                        "id": f"{name}-{label}-{index}",
                        "text": text,
                        "label": label,
                        "split": split,
                    }
                )
        dataset = workspace.create_dataset(f"Intelligent components: {name}", rows)
        run = workspace.learn(
            dataset["dataset_id"],
            candidates=["tfidf_word", "tfidf_char"],
            objective="quality",
            budget_seconds=120,
            execution="local",
        )
        result = workspace.wait(run["run_id"], timeout=180)
        if result["status"] != "succeeded":
            raise RuntimeError(f"Training {name} failed: {result}")
        workspace.review(run["run_id"])
        test = workspace.evaluate(run["run_id"])
        capability = workspace.publish(run["run_id"], name)
        selected = next(
            candidate
            for candidate in result["candidates"]
            if candidate["name"] == result["selected"]
        )
        print(
            json.dumps(
                {
                    "name": name,
                    "selected": result["selected"],
                    "validation": selected["validation"],
                    "test": test["models"][result["selected"]],
                    "capability": capability,
                },
                sort_keys=True,
            ),
            flush=True,
        )


if __name__ == "__main__":
    main()
