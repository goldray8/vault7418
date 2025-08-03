export default function SenderForm() {
  return (
    <form action="https://your-sender-form-url.com" method="post" className="mt-6">
      <input type="email" name="email" placeholder="Enter your email" required className="p-2 rounded w-full mb-2" />
      <button type="submit" className="bg-green-600 text-white p-2 rounded w-full">Join the Curse</button>
    </form>
  );
}