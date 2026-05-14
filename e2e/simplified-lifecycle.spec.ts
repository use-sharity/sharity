import { expect, test, type Browser, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

type SimplifiedLifecycleSeed = {
  itemId: string;
  claimId: string;
  itemName: string;
};

async function dismissProfilePrompt(page: Page) {
  const prompt = page.getByText("Complete Your Profile");
  if (!(await prompt.isVisible({ timeout: 1_000 }).catch(() => false))) return;

  await page.keyboard.press("Escape");
  await expect(prompt).toBeHidden({ timeout: 5_000 });
}

async function seedSimplifiedLifecycle(startOffsetMs = -3_600_000) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is required for E2E seeding");
  }
  const client = new ConvexHttpClient(convexUrl);
  return (await client.mutation(api.seed.setupSimplifiedLifecycleTest, {
    startOffsetMs,
  })) as SimplifiedLifecycleSeed;
}

async function openTwoPartyItem(args: {
  browser: Browser;
  baseURL: string | undefined;
  itemId: string;
  itemName: string;
}) {
  const firstContext = await args.browser.newContext({
    storageState: "playwright/.auth/user-a.json",
  });
  const secondContext = await args.browser.newContext({
    storageState: "playwright/.auth/user-b.json",
  });

  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  await Promise.all([
    firstPage.goto(`${args.baseURL}/en/item/${args.itemId}`),
    secondPage.goto(`${args.baseURL}/en/item/${args.itemId}`),
  ]);
  await Promise.all([
    expect(firstPage.getByText(args.itemName)).toBeVisible({
      timeout: 15_000,
    }),
    expect(secondPage.getByText(args.itemName)).toBeVisible({
      timeout: 15_000,
    }),
  ]);
  await Promise.all([
    dismissProfilePrompt(firstPage),
    dismissProfilePrompt(secondPage),
  ]);

  const firstOwns = await firstPage
    .getByText("You own this")
    .isVisible({ timeout: 2_000 })
    .catch(() => false);

  return {
    borrowerPage: firstOwns ? secondPage : firstPage,
    ownerPage: firstOwns ? firstPage : secondPage,
    close: async () => {
      await firstContext.close();
      await secondContext.close();
    },
  };
}

test.describe("Simplified received / returned lifecycle", () => {
  test("future approved request waits for the scheduled start", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "user-a", "Borrower-only guard check");
    const futureSeed = await seedSimplifiedLifecycle(86_400_000);

    await page.goto(`${baseURL}/en/item/${futureSeed.itemId}`);
    await expect(page.getByText(futureSeed.itemName)).toBeVisible({
      timeout: 15_000,
    });
    await dismissProfilePrompt(page);

    await expect(page.getByTestId("lease-next-action").first()).toContainText(
      "Next: your action",
    );
    await expect(page.getByTestId("lease-next-action").first()).toContainText(
      "Pickup time can be agreed below.",
    );
    await expect(
      page.getByRole("button", { name: "I received the item" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Suggest pickup time" }),
    ).toBeVisible();
  });

  test("borrower can propose an earlier pickup and receive after owner approves", async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(
      testInfo.project.name !== "user-a",
      "Runs once with two contexts",
    );

    const futureSeed = await seedSimplifiedLifecycle(86_400_000);
    const { borrowerPage, ownerPage, close } = await openTwoPartyItem({
      browser,
      baseURL,
      itemId: futureSeed.itemId,
      itemName: futureSeed.itemName,
    });

    await borrowerPage
      .getByRole("button", {
        name: /Suggest pickup time|Save pickup details|Suggest earlier pickup/,
      })
      .click();
    const proposalDialog = borrowerPage.getByRole("dialog");
    await expect(proposalDialog).toBeVisible();
    await proposalDialog.getByRole("button", { name: "Send proposal" }).click();

    await expect(
      borrowerPage.getByTestId("lease-next-action").first(),
    ).toContainText("Owner: approve your proposed pickup time", {
      timeout: 15_000,
    });

    await ownerPage.reload();
    await dismissProfilePrompt(ownerPage);
    await expect(
      ownerPage.getByRole("button", { name: "Approve pickup time" }),
    ).toBeVisible({ timeout: 15_000 });
    await ownerPage
      .getByRole("button", { name: "Approve pickup time" })
      .click();

    await borrowerPage.reload();
    await dismissProfilePrompt(borrowerPage);
    await expect(
      borrowerPage.getByRole("button", { name: "I received the item" }),
    ).toBeVisible({ timeout: 15_000 });
    await close();
  });

  test("borrower receives, requests return details, owner approves, and owner confirms returned", async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(
      testInfo.project.name !== "user-a",
      "Runs once with two contexts",
    );

    const seed = await seedSimplifiedLifecycle();
    const { borrowerPage, ownerPage, close } = await openTwoPartyItem({
      browser,
      baseURL,
      itemId: seed.itemId,
      itemName: seed.itemName,
    });

    await borrowerPage
      .getByRole("button", { name: "I received the item" })
      .click();
    const receiveDialog = borrowerPage.getByRole("dialog");
    await expect(receiveDialog).toBeVisible();
    await receiveDialog
      .getByRole("button", { name: "I received the item" })
      .click();

    await expect(
      borrowerPage.getByRole("button", { name: "Request return" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      borrowerPage.getByTestId("lease-next-action").first(),
    ).toContainText("request return");

    await borrowerPage.getByRole("button", { name: "Request return" }).click();
    const returnProposalDialog = borrowerPage.getByRole("dialog");
    await expect(returnProposalDialog).toBeVisible();
    await expect(
      returnProposalDialog.getByText(/^Meeting time:/),
    ).toBeVisible();
    await returnProposalDialog
      .getByRole("button", { name: "Send proposal" })
      .click();

    await expect(borrowerPage.getByText("Return proposed:")).toBeVisible({
      timeout: 15_000,
    });
    await expect(borrowerPage.getByText("Meeting time:")).toBeVisible();
    await expect(
      borrowerPage.getByTestId("lease-next-action").first(),
    ).toContainText("Owner: approve your proposed return details");

    await ownerPage.goto(`${baseURL}/en/item/${seed.itemId}`);
    await expect(ownerPage.getByText(seed.itemName)).toBeVisible({
      timeout: 15_000,
    });
    await dismissProfilePrompt(ownerPage);
    await expect(
      ownerPage.getByTestId("lease-next-action").first(),
    ).toContainText("review the proposed return details");
    await expect(ownerPage.getByText("Meeting time:")).toBeVisible();
    await ownerPage
      .getByRole("button", { name: "Approve return details" })
      .click();
    await expect(
      ownerPage.getByTestId("lease-next-action").first(),
    ).toContainText("confirm “Item returned”");
    await ownerPage.getByRole("button", { name: "Item returned" }).click();
    const returnDialog = ownerPage.getByRole("dialog");
    await expect(returnDialog).toBeVisible();
    await returnDialog.getByRole("button", { name: "Item returned" }).click();

    const showInactive = ownerPage.getByRole("button", {
      name: /Show Inactive|Toggle inactive requests/,
    });
    if (await showInactive.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await showInactive.click();
    }
    await expect(ownerPage.getByText("Item returned").first()).toBeVisible({
      timeout: 15_000,
    });
    await close();
  });

  test("owner can mark missing and then recover it as returned when the item comes back", async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(
      testInfo.project.name !== "user-a",
      "Runs once with two contexts",
    );

    const seed = await seedSimplifiedLifecycle();
    const { borrowerPage, ownerPage, close } = await openTwoPartyItem({
      browser,
      baseURL,
      itemId: seed.itemId,
      itemName: seed.itemName,
    });

    await borrowerPage
      .getByRole("button", { name: "I received the item" })
      .click();
    const receiveDialog = borrowerPage.getByRole("dialog");
    await expect(receiveDialog).toBeVisible();
    await receiveDialog
      .getByRole("button", { name: "I received the item" })
      .click();

    await borrowerPage.getByRole("button", { name: "Request return" }).click();
    const returnProposalDialog = borrowerPage.getByRole("dialog");
    await expect(returnProposalDialog).toBeVisible();
    await returnProposalDialog
      .getByRole("button", { name: "Send proposal" })
      .click();

    await ownerPage.goto(`${baseURL}/en/item/${seed.itemId}`);
    await expect(ownerPage.getByText(seed.itemName)).toBeVisible({
      timeout: 15_000,
    });
    await dismissProfilePrompt(ownerPage);
    await expect(
      ownerPage.getByRole("button", { name: "Mark item missing" }),
    ).toBeVisible({ timeout: 15_000 });
    await ownerPage.getByRole("button", { name: "Mark item missing" }).click();
    const missingDialog = ownerPage.getByRole("dialog");
    await expect(missingDialog).toBeVisible();
    await missingDialog
      .getByRole("button", { name: "Mark item missing" })
      .click();

    await expect(
      ownerPage.getByTestId("lease-next-action").first(),
    ).toContainText("Next: recover", { timeout: 15_000 });
    await expect(
      ownerPage.getByRole("button", { name: "Item returned" }),
    ).toBeVisible({ timeout: 15_000 });
    await ownerPage.getByRole("button", { name: "Item returned" }).click();
    const recoveredDialog = ownerPage.getByRole("dialog");
    await expect(recoveredDialog).toBeVisible();
    await recoveredDialog
      .getByRole("button", { name: "Item returned" })
      .click();

    const showInactive = ownerPage.getByRole("button", {
      name: /Show Inactive|Toggle inactive requests/,
    });
    if (await showInactive.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await showInactive.click();
    }
    await expect(ownerPage.getByText("Item returned").first()).toBeVisible({
      timeout: 15_000,
    });
    await close();
  });
});
