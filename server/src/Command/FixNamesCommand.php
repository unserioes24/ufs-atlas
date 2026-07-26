<?php

namespace App\Command;

use App\Entity\User;
use App\Service\Names;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Läuft beim Start vor dem Schemaabgleich: erst wenn keine zwei Konten
 * denselben Namen tragen, lässt sich der eindeutige Index anlegen.
 */
#[AsCommand(name: 'app:names:fix', description: 'Macht doppelte Benutzernamen eindeutig.')]
final class FixNamesCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Names $names,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $users = $this->em->getRepository(User::class)->createQueryBuilder('u')
            ->orderBy('u.id', 'ASC')->getQuery()->getResult();

        $seen = [];
        $fixed = 0;
        foreach ($users as $user) {
            $name = $this->names->normalize($user->getName());
            if (!$this->names->isValid($name)) {
                $name = 'Angler';
            }
            $key = mb_strtolower($name);
            if (isset($seen[$key]) || $name !== $user->getName()) {
                $base = $name;
                for ($i = 2; isset($seen[mb_strtolower($name)]); ++$i) {
                    $suffix = '-' . $i;
                    $name = mb_substr($base, 0, Names::MAX - mb_strlen($suffix)) . $suffix;
                }
                $user->setName($name);
                ++$fixed;
                $output->writeln(sprintf('Konto %d heißt jetzt "%s".', $user->getId(), $name));
            }
            $seen[mb_strtolower($name)] = true;
        }

        if ($fixed > 0) {
            $this->em->flush();
        }
        $output->writeln($fixed === 0 ? 'Alle Benutzernamen sind bereits eindeutig.' : $fixed . ' Namen angepasst.');

        return Command::SUCCESS;
    }
}
